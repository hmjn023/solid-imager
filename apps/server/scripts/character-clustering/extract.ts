import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	CCIP_MODEL,
	CCIP_EMBEDDING_VERSION,
} from "@solid-imager/application/services/ccip-vector-service";
import { Client } from "pg";
import pino from "pino";
import { z } from "zod";
import { mediaRecordSchema } from "./schemas";
import { checksum, encodeNpy, writeJson } from "./snapshot";

const logger = pino(
	{ level: process.env.LOG_LEVEL ?? "info" },
	pino.destination(2),
);
const INDEX_NAME = "idx_ccip_embeddings_embedding_cosine";
export const extractionOptionsSchema = z
	.object({
		neighbors: z.number().int().min(2).max(1000).default(64),
		efSearch: z.number().int().min(2).max(1000).default(256),
		batchSize: z.number().int().min(1).max(4096).default(128),
		recallSamples: z.number().int().min(0).max(1000).default(16),
		soloOnly: z.boolean().default(true),
		sourceId: z.uuid().optional(),
	})
	.refine(
		(value) => value.efSearch >= value.neighbors,
		"efSearch must be at least neighbors",
	);

const JOINS =
	"FROM ccip_embeddings e JOIN media_regions r ON r.id=e.region_id JOIN media m ON m.id=r.media_id";

export function eligibility(soloOnly: boolean, sourceId?: string) {
	const conditions = [
		"e.model=$1",
		"e.embedding_version=$2",
		"r.kind='full'",
		"m.status='active'",
		"m.media_type='image'",
		"e.extracted_at>=m.modified_at",
		"vector_norm(e.embedding)>0",
		"(SELECT count(*) FROM media_characters mc WHERE mc.media_id=m.id)<=1",
	];
	const parameters: (string | number)[] = [CCIP_MODEL, CCIP_EMBEDDING_VERSION];
	// A scalar correlated check prevents a pulled-up tag join from choosing
	// an exact full sort for every anchor instead of the ordered HNSW scan.
	if (soloOnly)
		conditions.push(
			"(SELECT EXISTS(SELECT 1 FROM media_tags mt JOIN tags t ON t.id=mt.tag_id WHERE mt.media_id=m.id AND t.name='solo'))",
		);
	if (sourceId) {
		parameters.push(sourceId);
		conditions.push(`m.source_id=$${parameters.length}::uuid`);
	}
	return { condition: conditions.join(" AND "), parameters };
}

export function neighborQuery(
	condition: string,
	parameters: number,
	exact = false,
): string {
	const order = exact
		? "(e.embedding <=> a.embedding)+0"
		: "e.embedding <=> a.embedding";
	return `SELECT a.id AS anchor_id,n.id AS neighbor_id,n.distance FROM ccip_embeddings a CROSS JOIN LATERAL
		(SELECT e.id,e.embedding <=> a.embedding AS distance ${JOINS} WHERE ${condition} AND e.id<>a.id
		ORDER BY ${order} LIMIT $${parameters + 1}) n WHERE a.id=ANY($${parameters + 2}::uuid[]) ORDER BY a.id,n.distance,n.id`;
}

/** JSON EXPLAIN is an external boundary; inspect it without asserting driver types. */
export function containsIndex(value: unknown): boolean {
	if (Array.isArray(value)) return value.some(containsIndex);
	if (value === null || typeof value !== "object") return false;
	return Object.entries(value).some(
		([key, child]) =>
			(key === "Index Name" && child === INDEX_NAME) || containsIndex(child),
	);
}

const neighborRowsSchema = z.array(
	z.object({
		anchor_id: z.uuid(),
		neighbor_id: z.uuid(),
		distance: z.number().min(-1e-6).max(2.000001),
	}),
);

export async function extract(output: string, request: object) {
	const options = extractionOptionsSchema.parse(request);
	await mkdir(path.dirname(output), { recursive: true });
	await mkdir(output);
	const started = performance.now();
	const initial = {
		formatVersion: 1,
		implementation: "typescript",
		status: "extracting",
		metric: "cosine",
		approximate: true,
		model: CCIP_MODEL,
		embeddingVersion: CCIP_EMBEDDING_VERSION,
		soloOnly: options.soloOnly,
		sourceId: options.sourceId ?? null,
		requestedNeighbors: options.neighbors,
		efSearch: options.efSearch,
		batchSize: options.batchSize,
		createdAt: new Date().toISOString(),
	};
	await writeJson(path.join(output, "graph.json"), initial);
	const env = process.env;
	const client = new Client({
		host: env.DB_HOST ?? env.PGHOST,
		port: z.coerce
			.number()
			.int()
			.min(1)
			.max(65535)
			.parse(env.DB_PORT ?? env.PGPORT ?? 5432),
		database: env.DB_DATABASE ?? env.DB_NAME ?? env.PGDATABASE,
		user: env.DB_USER ?? env.PGUSER,
		password: env.DB_PASSWORD ?? env.PGPASSWORD,
		application_name: "solid-imager-hdbscan-ts",
		connectionTimeoutMillis: 10_000,
	});
	let transaction = false;
	try {
		await client.connect();
		await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
		transaction = true;
		await client.query("SELECT set_config('hnsw.ef_search',$1,true)", [
			String(options.efSearch),
		]);
		await client.query("SET LOCAL hnsw.iterative_scan='strict_order'");
		await client.query("SET LOCAL statement_timeout='120s'");
		const snapshot = z
			.object({ value: z.string() })
			.parse(
				(await client.query("SELECT pg_current_snapshot()::text AS value"))
					.rows[0],
			).value;
		const pgvectorVersion = z
			.object({ extversion: z.string() })
			.parse(
				(
					await client.query(
						"SELECT extversion FROM pg_extension WHERE extname='vector'",
					)
				).rows[0],
			).extversion;
		const { condition, parameters } = eligibility(
			options.soloOnly,
			options.sourceId,
		);
		const metadataQuery = `SELECT e.id AS embedding_id,m.id AS media_id,m.source_id,m.file_name,
			e.extracted_at::text AS extracted_at,m.modified_at::text AS modified_at,
			COALESCE((SELECT json_agg(json_build_object('id',c.id,'name',c.name) ORDER BY c.id)
			FROM media_characters mc JOIN characters c ON c.id=mc.character_id WHERE mc.media_id=m.id),'[]'::json) AS characters
			${JOINS} WHERE ${condition} ORDER BY e.id`;
		const records = z
			.array(mediaRecordSchema)
			.parse((await client.query(metadataQuery, parameters)).rows);
		if (records.length < 2)
			throw new Error(
				"Fewer than two eligible current embeddings; check solo tags and source scope",
			);
		const k = Math.min(options.neighbors, records.length - 1);
		if (records.length * k > 0x3fffffff)
			throw new Error("Graph exceeds the supported typed-array dimensions");
		const ids = records.map((record) => record.embedding_id);
		const index = new Map(ids.map((id, i) => [id, i]));
		const query = neighborQuery(condition, parameters.length);
		const plan = (
			await client.query("EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) " + query, [
				...parameters,
				k,
				ids.slice(0, 1),
			])
		).rows;
		const batchPlan = (
			await client.query("EXPLAIN (FORMAT JSON) " + query, [
				...parameters,
				k,
				ids.slice(0, options.batchSize),
			])
		).rows;
		await writeJson(path.join(output, "query-plan.json"), {
			anchor: plan,
			batch: batchPlan,
		});
		if (!containsIndex(plan) || !containsIndex(batchPlan))
			throw new Error(
				"Nearest-neighbor query did not use the CCIP HNSW index; inspect query-plan.json",
			);
		const indices = new Int32Array(records.length * k).fill(-1);
		const distances = new Float64Array(indices.length).fill(NaN);
		let lastProgress = 0;
		for (let start = 0; start < ids.length; start += options.batchSize) {
			const batch = ids.slice(start, start + options.batchSize);
			const cursors = new Map(batch.map((id) => [id, 0]));
			const rows = neighborRowsSchema.parse(
				(await client.query(query, [...parameters, k, batch])).rows,
			);
			for (const row of rows) {
				const i = index.get(row.anchor_id);
				const j = index.get(row.neighbor_id);
				const position = cursors.get(row.anchor_id);
				if (
					i === undefined ||
					j === undefined ||
					position === undefined ||
					position >= k
				)
					throw new Error(
						"Neighbor not in the snapshot or invalid anchor count",
					);
				indices[i * k + position] = j;
				distances[i * k + position] = Math.max(0, row.distance);
				cursors.set(row.anchor_id, position + 1);
			}
			if ([...cursors.values()].some((count) => count !== k))
				throw new Error(
					"HNSW returned too few eligible neighbors; increase ef-search or scan budget",
				);
			if (performance.now() - lastProgress > 5000) {
				logger.info(
					{
						processed: Math.min(start + options.batchSize, ids.length),
						total: ids.length,
					},
					"CCIP neighbors extracted",
				);
				lastProgress = performance.now();
			}
		}
		// A deterministic xorshift sample, without replacement. Exact scans are
		// limited to this audit; graph extraction always uses HNSW.
		const samples = new Set<number>();
		let seed = 0x12345678;
		while (samples.size < Math.min(options.recallSamples, ids.length)) {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;
			samples.add(Math.floor(((seed >>> 0) / 0x100000000) * ids.length));
		}
		const audits = [];
		for (const position of samples) {
			const rows = neighborRowsSchema.parse(
				(
					await client.query(
						neighborQuery(condition, parameters.length, true),
						[...parameters, k, [ids[position]]],
					)
				).rows,
			);
			const exact = new Set(rows.map((row) => index.get(row.neighbor_id)));
			let found = 0;
			for (let j = 0; j < k; j++)
				if (exact.has(indices[position * k + j])) found++;
			audits.push({
				mediaId: records[position].media_id,
				recallAtK: found / k,
			});
		}
		await client.query("COMMIT");
		transaction = false;
		const files = {
			"media.jsonl": Buffer.from(
				records.map((record) => JSON.stringify(record)).join("\n") + "\n",
			),
			"indices.npy": encodeNpy(indices, records.length, k),
			"distances.npy": encodeNpy(distances, records.length, k),
		};
		for (const [name, data] of Object.entries(files))
			await writeFile(path.join(output, name), data, { flag: "wx" });
		const manifest = {
			...initial,
			status: "complete",
			snapshot,
			pgvectorVersion,
			points: records.length,
			neighbors: k,
			recallAudit: {
				samples: audits,
				meanRecallAtK: audits.length
					? audits.reduce((total, sample) => total + sample.recallAtK, 0) /
						audits.length
					: null,
			},
			extractionSeconds: (performance.now() - started) / 1000,
			checksums: {
				"media.jsonl": checksum(files["media.jsonl"]),
				"indices.npy": checksum(files["indices.npy"]),
				"distances.npy": checksum(files["distances.npy"]),
			},
		};
		await writeJson(path.join(output, "graph.json"), manifest);
		return manifest;
	} catch (error) {
		if (transaction) await client.query("ROLLBACK");
		await writeJson(path.join(output, "graph.json"), {
			...initial,
			status: "failed",
		});
		throw error;
	} finally {
		await client.end();
	}
}
