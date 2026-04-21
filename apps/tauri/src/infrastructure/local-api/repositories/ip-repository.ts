import {
	ResourceConflictError,
	ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import {
	type Ip,
	ipSchema,
	type NewIp,
	type UpdateIp,
} from "@solid-imager/core/domain/ips/schemas";
import { ips, mediaIps } from "@solid-imager/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";

function toIp(row: typeof ips.$inferSelect): Ip {
	return ipSchema.parse(row);
}

export const TauriIpRepository = {
	async findAll(): Promise<Ip[]> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(ips)
			.orderBy(asc(ips.name));
		return rows.map(toIp);
	},

	async findById(id: string): Promise<Ip | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(ips)
			.where(eq(ips.id, id))
			.limit(1);
		return rows[0] ? toIp(rows[0]) : null;
	},

	async findByName(name: string): Promise<Ip | null> {
		const rows = await getTauriAppServices()
			.db.select()
			.from(ips)
			.where(eq(ips.name, name))
			.limit(1);
		return rows[0] ? toIp(rows[0]) : null;
	},

	async findByNames(names: string[]): Promise<Ip[]> {
		if (names.length === 0) {
			return [];
		}
		const rows = await getTauriAppServices()
			.db.select()
			.from(ips)
			.where(inArray(ips.name, names))
			.orderBy(asc(ips.name));
		return rows.map(toIp);
	},

	async create(input: NewIp): Promise<Ip> {
		const existing = await this.findByName(input.name);
		if (existing) {
			throw new ResourceConflictError(
				`IP with name '${input.name}' already exists`,
			);
		}

		const rows = await getTauriAppServices()
			.db.insert(ips)
			.values({
				name: input.name,
				description: input.description ?? "",
				source: input.source ?? "manual",
			})
			.returning();
		return toIp(rows[0]);
	},

	async update(id: string, input: UpdateIp): Promise<Ip> {
		const rows = await getTauriAppServices()
			.db.update(ips)
			.set({
				...(input.name !== undefined ? { name: input.name } : {}),
				...(input.description !== undefined
					? { description: input.description ?? "" }
					: {}),
				...(input.source !== undefined ? { source: input.source } : {}),
				updatedAt: new Date(),
			})
			.where(eq(ips.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("IP", id);
		}

		return toIp(rows[0]);
	},

	async delete(id: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(ips)
			.where(eq(ips.id, id))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("IP", id);
		}
	},

	async findByMediaId(mediaId: string): Promise<Ip[]> {
		const rows = await getTauriAppServices()
			.db.select({
				id: ips.id,
				name: ips.name,
				description: ips.description,
				source: ips.source,
				createdAt: ips.createdAt,
				updatedAt: ips.updatedAt,
			})
			.from(ips)
			.innerJoin(mediaIps, eq(ips.id, mediaIps.ipId))
			.where(eq(mediaIps.mediaId, mediaId))
			.orderBy(asc(ips.name));
		return rows.map(toIp);
	},

	async getMediaIps(
		mediaId: string,
	): Promise<
		(Ip & { confidence: number | null; associationSource: string })[]
	> {
		const rows = await getTauriAppServices()
			.db.select({
				id: ips.id,
				name: ips.name,
				description: ips.description,
				source: ips.source,
				createdAt: ips.createdAt,
				updatedAt: ips.updatedAt,
				confidence: mediaIps.confidence,
				associationSource: mediaIps.source,
			})
			.from(ips)
			.innerJoin(mediaIps, eq(ips.id, mediaIps.ipId))
			.where(eq(mediaIps.mediaId, mediaId))
			.orderBy(asc(ips.name));

		return rows.map((row) => ({
			...toIp(row),
			confidence: row.confidence,
			associationSource: row.associationSource,
		}));
	},

	async addMedia(
		mediaId: string,
		ipId: string,
		confidence?: number,
		source = "manual",
		tx?: TauriDbExecutor,
	): Promise<void> {
		const executor = tx ?? getTauriAppServices().db;
		let sourceUpdateSql = sql`excluded.source`;
		let confidenceUpdateSql = sql`excluded.confidence`;

		if (source === "AI") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.confidence ELSE media_ips.confidence END`;
		} else if (source === "manual") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_ips.confidence END`;
		}

		await executor
			.insert(mediaIps)
			.values({
				mediaId,
				ipId,
				confidence: confidence ?? null,
				source,
			})
			.onConflictDoUpdate({
				target: [mediaIps.mediaId, mediaIps.ipId],
				set: {
					confidence: confidenceUpdateSql,
					source: sourceUpdateSql,
				},
			});
	},

	async removeMedia(mediaId: string, ipId: string): Promise<void> {
		const rows = await getTauriAppServices()
			.db.delete(mediaIps)
			.where(and(eq(mediaIps.mediaId, mediaId), eq(mediaIps.ipId, ipId)))
			.returning();

		if (!rows[0]) {
			throw new ResourceNotFoundError("MediaIP association");
		}
	},

	async addMediaBulk(
		mediaId: string,
		ipsData: { id: string; confidence?: number }[],
		source = "manual",
		tx?: TauriDbExecutor,
	): Promise<void> {
		for (const ip of ipsData) {
			await this.addMedia(mediaId, ip.id, ip.confidence, source, tx);
		}
	},
};
