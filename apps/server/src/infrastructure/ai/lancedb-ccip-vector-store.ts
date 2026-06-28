import * as path from "node:path";
import type { Connection, Table } from "@lancedb/lancedb";
import type {
	CcipVectorCandidate,
	CcipVectorRecord,
	ICcipVectorStore,
} from "@solid-imager/application/ports/ccip-vector-store";
import { z } from "zod";

const TABLE_NAME = "media_ccip";
const VECTOR_DIMENSIONS = 768;

const rowSchema = z.object({
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
	extractedAt: z.coerce.date(),
	_distance: z.number().optional(),
});

function escapeSqlString(value: string): string {
	return value.replaceAll("'", "''");
}

function toRecord(value: unknown): CcipVectorRecord {
	const row = rowSchema.parse(value);
	return {
		mediaId: row.mediaId,
		mediaSourceId: row.mediaSourceId,
		vector: row.vector,
		model: row.model,
		embeddingVersion: row.embeddingVersion,
		mediaModifiedAt: row.mediaModifiedAt,
		extractedAt: row.extractedAt,
	};
}

export class LanceDbCcipVectorStore implements ICcipVectorStore {
	private connectionPromise: Promise<Connection> | null = null;
	private tablePromise: Promise<Table> | null = null;
	private writeQueue: Promise<void> = Promise.resolve();

	constructor(private readonly directory: string) {}

	private async connection(): Promise<Connection> {
		if (!this.connectionPromise) {
			this.connectionPromise = import("@lancedb/lancedb").then((lancedb) =>
				lancedb.connect(path.resolve(process.cwd(), this.directory)),
			);
		}
		return await this.connectionPromise;
	}

	private async table(): Promise<Table> {
		if (!this.tablePromise) {
			this.tablePromise = this.openOrCreateTable();
		}
		return await this.tablePromise;
	}

	private async openOrCreateTable(): Promise<Table> {
		const db = await this.connection();
		const tableNames = await db.tableNames();
		if (tableNames.includes(TABLE_NAME)) {
			return await db.openTable(TABLE_NAME);
		}
		const arrow = await import("apache-arrow");
		const schema = new arrow.Schema([
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
		]);
		return await db.createTable(TABLE_NAME, [], { schema });
	}

	private async serializeWrite(operation: () => Promise<void>): Promise<void> {
		const next = this.writeQueue.then(operation, operation);
		this.writeQueue = next.catch(() => undefined);
		await next;
	}

	async get(mediaId: string): Promise<CcipVectorRecord | null> {
		const table = await this.table();
		const rows = await table
			.query()
			.where(`mediaId = '${escapeSqlString(mediaId)}'`)
			.limit(1)
			.toArray();
		return rows[0] ? toRecord(rows[0]) : null;
	}

	async upsert(record: CcipVectorRecord): Promise<void> {
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table
				.mergeInsert("mediaId")
				.whenMatchedUpdateAll()
				.whenNotMatchedInsertAll()
				.execute([
					{
						...record,
						mediaModifiedAt: record.mediaModifiedAt,
						extractedAt: record.extractedAt,
					},
				]);
		});
	}

	async delete(mediaId: string): Promise<void> {
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(`mediaId = '${escapeSqlString(mediaId)}'`);
		});
	}

	async deleteBySource(mediaSourceId: string): Promise<void> {
		await this.serializeWrite(async () => {
			const table = await this.table();
			await table.delete(`mediaSourceId = '${escapeSqlString(mediaSourceId)}'`);
		});
	}

	async listMediaIds(mediaSourceId?: string): Promise<string[]> {
		const table = await this.table();
		const query = table.query().select(["mediaId"]);
		if (mediaSourceId) {
			query.where(`mediaSourceId = '${escapeSqlString(mediaSourceId)}'`);
		}
		const rows = await query.toArray();
		return rows.flatMap((row) => {
			const result = z.object({ mediaId: z.string().uuid() }).safeParse(row);
			return result.success ? [result.data.mediaId] : [];
		});
	}

	async list(mediaSourceId?: string): Promise<CcipVectorRecord[]> {
		const table = await this.table();
		const query = table.query();
		if (mediaSourceId) {
			query.where(`mediaSourceId = '${escapeSqlString(mediaSourceId)}'`);
		}
		const rows = await query.toArray();
		return rows.map(toRecord);
	}

	async search(
		vector: number[],
		limit: number,
		mediaSourceId?: string,
	): Promise<CcipVectorCandidate[]> {
		const table = await this.table();
		const query = table
			.vectorSearch(vector)
			.distanceType("cosine")
			.limit(limit);
		if (mediaSourceId) {
			query.where(`mediaSourceId = '${escapeSqlString(mediaSourceId)}'`);
		}
		const rows = await query.toArray();
		return rows.map((value) => {
			const row = rowSchema.parse(value);
			return {
				...toRecord(value),
				cosineDistance: row._distance ?? 0,
			};
		});
	}
}
