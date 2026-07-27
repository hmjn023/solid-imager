import * as path from "node:path";
import type { Connection, Table } from "@lancedb/lancedb";
import type {
	CcipVectorCandidate,
	CcipEmbeddingKey,
	CcipVectorMetadata,
	CcipVectorQuery,
	CcipVectorReadQuery,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import { z } from "zod";

const TABLE_NAME = "media_ccip";
const VECTOR_DIMENSIONS = 768;
const AUTO_OPTIMIZE_WRITE_OPERATIONS = 100;
const LEGACY_INPUT_REVISION = "legacy-unversioned";
const DEFAULT_PREPROCESSING_PROFILE =
	"dghs-imgutils-rs/full-image-default/v1";

export class CcipStoreReadOnlyError extends Error {
	constructor() {
		super("CCIP LanceDB store is read-only");
		this.name = "CcipStoreReadOnlyError";
	}
}

export class CcipStoreUnsupportedOperationError extends Error {
	constructor(readonly operation: string) {
		super(`${operation} is unavailable in legacy LanceDB mode`);
		this.name = "CcipStoreUnsupportedOperationError";
	}
}

const rowSchema = z.object({
	regionKey: z.string().optional(),
	regionId: z.string().uuid().nullable().optional(),
	regionKind: z.enum(["full", "person", "manual"]).optional(),
	mediaId: z.string().uuid(),
	mediaSourceId: z.string().uuid(),
	vector: z.preprocess((value) => {
		if (Array.isArray(value)) return value;
		if (
			typeof value === "object" &&
			value !== null &&
			Symbol.iterator in value
		) {
			// Apache Arrow returns a Vector object at this external boundary.
			return Array.from(value as Iterable<unknown>);
		}
		return value;
	}, z.array(z.number()).length(VECTOR_DIMENSIONS)),
	model: z.string(),
	embeddingVersion: z.number().int(),
	mediaModifiedAt: z.coerce.date(),
	inputRevision: z.string().min(1).optional(),
	preprocessingProfile: z.string().min(1).optional(),
	extractedAt: z.coerce.date(),
	_distance: z.number().optional(),
});

const metadataRowSchema = rowSchema.omit({
	vector: true,
	_distance: true,
});

function escapeSqlString(value: string): string {
	return value.replaceAll("'", "''");
}

function queryPredicates(
	query?: CcipVectorQuery,
	includeVersionedColumns = true,
): string[] {
	const predicates: string[] = [];
	if (includeVersionedColumns && query?.regionId) {
		predicates.push(`regionId = '${escapeSqlString(query.regionId)}'`);
	}
	if (includeVersionedColumns && query?.regionKind) {
		predicates.push(`regionKind = '${escapeSqlString(query.regionKind)}'`);
	}
	if (query?.mediaSourceId) {
		predicates.push(
			`mediaSourceId = '${escapeSqlString(query.mediaSourceId)}'`,
		);
	}
	if (query?.model) {
		predicates.push(`model = '${escapeSqlString(query.model)}'`);
	}
	if (query?.embeddingVersion !== undefined) {
		predicates.push(`embeddingVersion = ${query.embeddingVersion}`);
	}
	if (includeVersionedColumns && query?.preprocessingProfile) {
		predicates.push(
			`preprocessingProfile = '${escapeSqlString(query.preprocessingProfile)}'`,
		);
	}
	return predicates;
}

function toRecord(value: unknown): CcipVectorRecord {
	const row = rowSchema.parse(value);
	return {
		regionId: row.regionId ?? null,
		regionKind: row.regionKind ?? "full",
		mediaId: row.mediaId,
		mediaSourceId: row.mediaSourceId,
		vector: row.vector,
		model: row.model,
		embeddingVersion: row.embeddingVersion,
		mediaModifiedAt: row.mediaModifiedAt,
		inputRevision: row.inputRevision ?? LEGACY_INPUT_REVISION,
		preprocessingProfile:
			row.preprocessingProfile ?? DEFAULT_PREPROCESSING_PROFILE,
		extractedAt: row.extractedAt,
	};
}

function toMetadata(value: unknown): CcipVectorMetadata {
	const row = metadataRowSchema.parse(value);
	return {
		regionId: row.regionId ?? null,
		regionKind: row.regionKind ?? "full",
		mediaId: row.mediaId,
		mediaSourceId: row.mediaSourceId,
		model: row.model,
		embeddingVersion: row.embeddingVersion,
		mediaModifiedAt: row.mediaModifiedAt,
		inputRevision: row.inputRevision ?? LEGACY_INPUT_REVISION,
		preprocessingProfile:
			row.preprocessingProfile ?? DEFAULT_PREPROCESSING_PROFILE,
		extractedAt: row.extractedAt,
	};
}

export class LanceDbCcipVectorStore implements ICcipVectorStore {
	private connectionPromise: Promise<Connection> | null = null;
	private tablePromise: Promise<Table> | null = null;
	private writeQueue: Promise<void> = Promise.resolve();
	private writeOperationsSinceOptimize = 0;

	constructor(
		private readonly directory: string,
		private readonly options: { readOnly?: boolean; legacy?: boolean } = {},
	) {}

	private async connection(): Promise<Connection> {
		if (!this.connectionPromise) {
			this.connectionPromise = import("@lancedb/lancedb")
				.then((lancedb) =>
					lancedb.connect(path.resolve(process.cwd(), this.directory), {
						// Vite HMR can leave the job worker and API handler with
						// different Table handles. Check the latest committed version on
						// every read so a completed extraction is immediately visible.
						readConsistencyInterval: 0,
					}),
				)
				.catch((err) => {
					this.connectionPromise = null;
					throw err;
				});
		}
		return await this.connectionPromise;
	}

	private async table(): Promise<Table> {
		if (!this.tablePromise) {
			this.tablePromise = this.openOrCreateTable().catch((err) => {
				this.tablePromise = null;
				throw err;
			});
		}
		return await this.tablePromise;
	}

	private async openOrCreateTable(): Promise<Table> {
		const db = await this.connection();
		let table: Table;
		try {
			table = await db.openTable(TABLE_NAME);
		} catch (error) {
			if (this.options.readOnly) {
				throw new Error(
					`CCIP LanceDB table ${TABLE_NAME} is unavailable in read-only mode`,
					{
						cause: error,
					},
				);
			}
			const arrow = await import("apache-arrow");
			const sharedFields = [
				new arrow.Field("mediaId", new arrow.Utf8(), false),
				new arrow.Field("mediaSourceId", new arrow.Utf8(), false),
				new arrow.Field(
					"vector",
					new arrow.FixedSizeList(
						VECTOR_DIMENSIONS,
						new arrow.Field("item", new arrow.Float32(), false),
					),
					false,
				),
				new arrow.Field("model", new arrow.Utf8(), false),
				new arrow.Field("embeddingVersion", new arrow.Int32(), false),
				new arrow.Field(
					"mediaModifiedAt",
					new arrow.TimestampMillisecond(),
					false,
				),
				new arrow.Field("extractedAt", new arrow.TimestampMillisecond(), false),
			];
			const schema = new arrow.Schema(
				this.options.legacy
					? sharedFields
					: [
							new arrow.Field("regionKey", new arrow.Utf8(), false),
							new arrow.Field("regionId", new arrow.Utf8(), true),
							new arrow.Field("regionKind", new arrow.Utf8(), false),
							...sharedFields,
							new arrow.Field("inputRevision", new arrow.Utf8(), false),
							new arrow.Field(
								"preprocessingProfile",
								new arrow.Utf8(),
								false,
							),
						],
			);
			table = await db.createTable(TABLE_NAME, [], { schema });
		}
		if (!this.options.readOnly) {
			await this.ensureMediaIdIndex(table);
		}
		return table;
	}

	private async ensureMediaIdIndex(table: Table): Promise<void> {
		const indices = await table.listIndices();
		if (
			indices.some((index) => index.columns.includes("mediaId")) ||
			(await table.countRows()) === 0
		) {
			return;
		}
		const { Index } = await import("@lancedb/lancedb");
		await table.createIndex("mediaId", { config: Index.btree() });
	}

	private async serializeWrite(operation: () => Promise<void>): Promise<void> {
		if (this.options.readOnly) {
			throw new CcipStoreReadOnlyError();
		}
		const next = this.writeQueue.then(operation, operation);
		this.writeQueue = next.catch(() => undefined);
		await next;
	}

	async get(
		mediaId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		return (await this.getMany([mediaId], query)).get(mediaId) ?? null;
	}

	async getByRegion(
		regionId: string,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorRecord | null> {
		if (this.options.legacy) return null;
		const table = await this.table();
		const rows = await table
			.query()
			.where(
				[
					`regionId = '${escapeSqlString(regionId)}'`,
					...queryPredicates(query, true),
				].join(" AND "),
			)
			.limit(1)
			.toArray();
		return rows[0] ? toRecord(rows[0]) : null;
	}

	async getMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorRecord>> {
		if (mediaIds.length === 0) {
			return new Map();
		}
		const predicates = [
			`mediaId IN (${mediaIds.map((mediaId) => `'${escapeSqlString(mediaId)}'`).join(", ")})`,
			...queryPredicates(query, !this.options.legacy),
		];
		const table = await this.table();
		const rows = await table.query().where(predicates.join(" AND ")).toArray();
		return new Map(
			rows.map((row) => {
				const record = toRecord(row);
				return [record.mediaId, record];
			}),
		);
	}

	async getMetadataMany(
		mediaIds: string[],
		query: CcipVectorReadQuery,
	): Promise<Map<string, CcipVectorMetadata>> {
		if (mediaIds.length === 0) {
			return new Map();
		}
		const predicates = [
			`mediaId IN (${mediaIds.map((mediaId) => `'${escapeSqlString(mediaId)}'`).join(", ")})`,
			...queryPredicates(query, !this.options.legacy),
		];
		const table = await this.table();
		const selectedColumns = [
				"mediaId",
				"mediaSourceId",
				"model",
				"embeddingVersion",
				"mediaModifiedAt",
				"extractedAt",
			];
		if (!this.options.legacy) {
			selectedColumns.push(
				"regionId",
				"regionKind",
				"inputRevision",
				"preprocessingProfile",
			);
		}
		const rows = await table
			.query()
			.select(selectedColumns)
			.where(predicates.join(" AND "))
			.toArray();
		return new Map(
			rows.map((row) => {
				const metadata = toMetadata(row);
				return [metadata.mediaId, metadata];
			}),
		);
	}

	async upsert(record: CcipVectorRecord): Promise<void> {
		await this.upsertMany([record]);
	}

	async upsertMany(records: CcipVectorRecord[]): Promise<void> {
		if (records.length === 0) {
			return;
		}
		await this.serializeWrite(async () => {
			const table = await this.table();
			if (this.options.legacy) {
				await table
					.mergeInsert("mediaId")
					.whenMatchedUpdateAll()
					.whenNotMatchedInsertAll()
					.execute(
						records.map((record) => ({
							mediaId: record.mediaId,
							mediaSourceId: record.mediaSourceId,
							vector: record.vector,
							model: record.model,
							embeddingVersion: record.embeddingVersion,
							mediaModifiedAt: record.mediaModifiedAt,
							extractedAt: record.extractedAt,
						})),
					);
				return;
			}
			await table
				.mergeInsert("regionKey")
				.whenMatchedUpdateAll()
				.whenNotMatchedInsertAll()
				.execute(
					records.map((record) => ({
						...record,
						regionKey: record.regionId ?? `full:${record.mediaId}`,
					})),
				);
			this.writeOperationsSinceOptimize++;
			if (this.writeOperationsSinceOptimize >= AUTO_OPTIMIZE_WRITE_OPERATIONS) {
				await table.optimize();
				await this.ensureMediaIdIndex(table);
				this.writeOperationsSinceOptimize = 0;
			}
		});
	}

	async delete(mediaId: string): Promise<void> {
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(`mediaId = '${escapeSqlString(mediaId)}'`);
		});
	}

	async deleteRegion(regionId: string): Promise<void> {
		if (this.options.legacy) {
			throw new CcipStoreUnsupportedOperationError("deleteRegion");
		}
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(`regionId = '${escapeSqlString(regionId)}'`);
		});
	}

	async deleteEmbedding(key: CcipEmbeddingKey): Promise<void> {
		if (this.options.legacy) {
			throw new CcipStoreUnsupportedOperationError("deleteEmbedding");
		}
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(
				[
					`regionId = '${escapeSqlString(key.regionId)}'`,
					`model = '${escapeSqlString(key.model)}'`,
					`embeddingVersion = ${key.embeddingVersion}`,
					`preprocessingProfile = '${escapeSqlString(key.preprocessingProfile)}'`,
				].join(" AND "),
			);
		});
	}

	async deleteBySource(mediaSourceId: string): Promise<void> {
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(`mediaSourceId = '${escapeSqlString(mediaSourceId)}'`);
		});
	}

	async listMediaIds(query?: CcipVectorQuery): Promise<string[]> {
		const table = await this.table();
		const tableQuery = table.query().select(["mediaId"]);
		const predicates = queryPredicates(query, !this.options.legacy);
		if (predicates.length > 0) {
			tableQuery.where(predicates.join(" AND "));
		}
		const rows = await tableQuery.toArray();
		return rows.flatMap((row) => {
			const result = z.object({ mediaId: z.string().uuid() }).safeParse(row);
			return result.success ? [result.data.mediaId] : [];
		});
	}

	async list(query?: CcipVectorQuery): Promise<CcipVectorRecord[]> {
		const table = await this.table();
		const tableQuery = table.query();
		const predicates = queryPredicates(query, !this.options.legacy);
		if (predicates.length > 0) {
			tableQuery.where(predicates.join(" AND "));
		}
		const rows = await tableQuery.toArray();
		return rows.map(toRecord);
	}

	/**
	 * Reads legacy rows in bounded pages for the one-time PostgreSQL migration.
	 * Ordering groups duplicate logical embeddings next to one another so the
	 * caller can resolve them without retaining the complete table in memory.
	 */
	async *listBatches(
		batchSize: number,
		query?: CcipVectorQuery,
	): AsyncGenerator<CcipVectorRecord[]> {
		if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
			throw new Error("batchSize must be a positive integer");
		}
		const table = await this.table();
		const predicates = queryPredicates(query, !this.options.legacy);
		let offset = 0;
		while (true) {
			const tableQuery = table
				.query()
				.orderBy([
					{ columnName: "mediaId" },
					{ columnName: "model" },
					{ columnName: "embeddingVersion" },
					{ columnName: "extractedAt" },
				])
				.limit(batchSize)
				.offset(offset);
			if (predicates.length > 0) {
				tableQuery.where(predicates.join(" AND "));
			}
			const rows = await tableQuery.toArray();
			if (rows.length === 0) {
				return;
			}
			yield rows.map(toRecord);
			offset += rows.length;
			if (rows.length < batchSize) {
				return;
			}
		}
	}

	async search(
		vector: number[],
		limit: number,
		query: CcipVectorReadQuery,
	): Promise<CcipVectorCandidate[]> {
		const table = await this.table();
		const tableQuery = table
			.vectorSearch(vector)
			.distanceType("cosine")
			.limit(limit);
		const predicates = queryPredicates(query, !this.options.legacy);
		if (predicates.length > 0) {
			tableQuery.where(predicates.join(" AND "));
		}
		const rows = await tableQuery.toArray();
		return rows.map((value) => {
			const row = rowSchema.parse(value);
			return {
				...toRecord(value),
				cosineDistance: row._distance ?? 0,
			};
		});
	}
}
