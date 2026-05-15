import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type {
	Ip,
	NewIp,
	UpdateIp,
} from "@solid-imager/core/domain/ips/schemas";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { getClient } from "@solid-imager/db";
import { ips, mediaIps } from "@solid-imager/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";

const mapToDomain = (dbIp: typeof ips.$inferSelect): Ip => ({
	id: dbIp.id,
	name: dbIp.name,
	description: dbIp.description,
	source: dbIp.source,
	createdAt: dbIp.createdAt || new Date(),
	updatedAt: dbIp.updatedAt || new Date(),
});

export const IpRepository: IIpRepository = {
	async findAll(): Promise<Ip[]> {
		const dbIps = await db.select().from(ips);
		return dbIps.map(mapToDomain);
	},

	async findById(id: string, tx?: Transaction): Promise<Ip | null> {
		const client = getClient(db, tx);
		const result = await client.select().from(ips).where(eq(ips.id, id));
		return result[0] ? mapToDomain(result[0]) : null;
	},

	async findByName(name: string, tx?: Transaction): Promise<Ip | null> {
		const client = getClient(db, tx);
		const result = await client.select().from(ips).where(eq(ips.name, name));
		return result[0] ? mapToDomain(result[0]) : null;
	},
	async findByNames(names: string[], tx?: Transaction): Promise<Ip[]> {
		if (names.length === 0) {
			return [];
		}
		const { inArray } = await import("drizzle-orm");
		const client = getClient(db, tx);
		const result = await client
			.select()
			.from(ips)
			.where(inArray(ips.name, names));
		return result.map(mapToDomain);
	},

	async create(ip: NewIp, tx?: Transaction): Promise<Ip> {
		try {
			const client = getClient(db, tx);
			const result = await client.insert(ips).values(ip).returning();
			return mapToDomain(result[0]);
		} catch (error: unknown) {
			if ((error as any).code === "23505") {
				throw new ResourceConflictError("IP with this name already exists");
			}
			throw error;
		}
	},

	async update(id: string, ip: UpdateIp, tx?: Transaction): Promise<Ip> {
		try {
			const client = getClient(db, tx);
			const result = await client
				.update(ips)
				.set({ ...ip, updatedAt: new Date() })
				.where(eq(ips.id, id))
				.returning();

			if (!result[0]) {
				throw new ResourceNotFoundError("IP", id);
			}
			return mapToDomain(result[0]);
		} catch (error: unknown) {
			if (error instanceof ResourceNotFoundError) {
				throw error;
			}
			if ((error as any).code === "23505") {
				throw new ResourceConflictError("IP with this name already exists");
			}
			throw new UnexpectedError("Failed to update IP", error);
		}
	},

	async delete(id: string, tx?: Transaction): Promise<void> {
		const client = getClient(db, tx);
		const result = await client.delete(ips).where(eq(ips.id, id)).returning();
		if (result.length === 0) {
			throw new ResourceNotFoundError("IP", id);
		}
	},

	async findByMediaId(mediaId: string, tx?: Transaction): Promise<Ip[]> {
		const client = getClient(db, tx);
		const result = await client
			.select({
				id: ips.id,
				name: ips.name,
				description: ips.description,
				source: ips.source,
				createdAt: ips.createdAt,
				updatedAt: ips.updatedAt,
			})
			.from(ips)
			.innerJoin(mediaIps, eq(ips.id, mediaIps.ipId))
			.where(eq(mediaIps.mediaId, mediaId));

		return result.map((i: any) => ({
			...i,
			createdAt: i.createdAt || new Date(),
			updatedAt: i.updatedAt || new Date(),
		}));
	},

	async getMediaIps(
		mediaId: string,
		tx?: Transaction,
	): Promise<
		(Ip & { confidence: number | null; associationSource: string })[]
	> {
		const client = getClient(db, tx);
		const result = await client
			.select({
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
			.where(eq(mediaIps.mediaId, mediaId));

		return result.map((i) => ({
			...i,
			createdAt: i.createdAt || new Date(),
			updatedAt: i.updatedAt || new Date(),
		}));
	},

	async addMedia(
		mediaId: string,
		ipId: string,
		confidence?: number,
		source = "manual",
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);

		let sourceUpdateSql = sql`excluded.source`;
		let confidenceUpdateSql = sql`excluded.confidence`;

		if (source === "AI") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.confidence ELSE media_ips.confidence END`;
		} else if (source === "manual") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_ips.confidence END`;
		}

		await client
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

	async removeMedia(
		mediaId: string,
		ipId: string,
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);
		const result = await client
			.delete(mediaIps)
			.where(and(eq(mediaIps.mediaId, mediaId), eq(mediaIps.ipId, ipId)))
			.returning();

		if (result.length === 0) {
			throw new ResourceNotFoundError("MediaIP association");
		}
	},
	async addMediaBulk(
		mediaId: string,
		ipsData: { id: string; confidence?: number }[],
		source = "manual",
		tx?: Transaction,
	): Promise<void> {
		const client = getClient(db, tx);
		if (ipsData.length === 0) {
			return;
		}

		let sourceUpdateSql = sql`excluded.source`;
		let confidenceUpdateSql = sql`excluded.confidence`;

		if (source === "AI") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.confidence ELSE media_ips.confidence END`;
		} else if (source === "manual") {
			sourceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.source ELSE media_ips.source END`;
			confidenceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_ips.confidence END`;
		}

		await client
			.insert(mediaIps)
			.values(
				ipsData.map((data) => ({
					mediaId,
					ipId: data.id,
					confidence: data.confidence ?? null,
					source,
				})),
			)
			.onConflictDoUpdate({
				target: [mediaIps.mediaId, mediaIps.ipId],
				set: {
					confidence: confidenceUpdateSql,
					source: sourceUpdateSql,
				},
			});
	},
};
