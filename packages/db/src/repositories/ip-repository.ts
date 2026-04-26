import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type { Ip, NewIp, UpdateIp } from "@solid-imager/core/domain/ips/schemas";
import { ipSchema } from "@solid-imager/core/domain/ips/schemas";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { ips, mediaIps } from "../schema";
import type { DrizzleExecutor } from "../types";

export type IpRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;

type IpWithAssociation = Ip & {
	confidence: number | null;
	associationSource: string;
};

type CreateIpRepositoryOptions = {
	orderByName?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
	return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function mapToIp(row: typeof ips.$inferSelect): Ip {
	return ipSchema.parse({
		id: row.id,
		name: row.name,
		description: row.description,
		source: row.source,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
}

function mediaIpConflictSet(source: string) {
	let sourceUpdateSql = sql`excluded.source`;
	let confidenceUpdateSql = sql`excluded.confidence`;

	if (source === "AI") {
		sourceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.source ELSE media_ips.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_ips.source = 'AI' THEN excluded.confidence ELSE media_ips.confidence END`;
	} else if (source === "manual") {
		sourceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.source ELSE media_ips.source END`;
		confidenceUpdateSql = sql`CASE WHEN media_ips.source IN ('AI', 'manual') THEN excluded.confidence ELSE media_ips.confidence END`;
	}

	return {
		source: sourceUpdateSql,
		confidence: confidenceUpdateSql,
	};
}

export function createIpRepository(
	getExecutor: IpRepositoryExecutorProvider,
	options: CreateIpRepositoryOptions = {},
): IIpRepository {
	return {
		async findAll(): Promise<Ip[]> {
			const query = getExecutor().select().from(ips);
			const rows = options.orderByName ? await query.orderBy(asc(ips.name)) : await query;
			return rows.map(mapToIp);
		},

		async findById(id: string, tx?: unknown): Promise<Ip | null> {
			const rows = await getExecutor(tx).select().from(ips).where(eq(ips.id, id)).limit(1);
			return rows[0] ? mapToIp(rows[0]) : null;
		},

		async findByName(name: string, tx?: unknown): Promise<Ip | null> {
			const rows = await getExecutor(tx).select().from(ips).where(eq(ips.name, name)).limit(1);
			return rows[0] ? mapToIp(rows[0]) : null;
		},

		async findByNames(names: string[], tx?: unknown): Promise<Ip[]> {
			if (names.length === 0) {
				return [];
			}
			const query = getExecutor(tx).select().from(ips).where(inArray(ips.name, names));
			const rows = options.orderByName ? await query.orderBy(asc(ips.name)) : await query;
			return rows.map(mapToIp);
		},

		async create(input: NewIp, tx?: unknown): Promise<Ip> {
			try {
				const rows = await getExecutor(tx)
					.insert(ips)
					.values({
						name: input.name,
						description: input.description ?? null,
						source: input.source ?? "manual",
					})
					.returning();
				return mapToIp(rows[0]);
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError("IP with this name already exists");
				}
				throw error;
			}
		},

		async update(id: string, input: UpdateIp, tx?: unknown): Promise<Ip> {
			try {
				const rows = await getExecutor(tx)
					.update(ips)
					.set({
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.description !== undefined ? { description: input.description ?? null } : {}),
						...(input.source !== undefined ? { source: input.source } : {}),
						updatedAt: new Date(),
					})
					.where(eq(ips.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("IP", id);
				}
				return mapToIp(rows[0]);
			} catch (error) {
				if (error instanceof ResourceNotFoundError) {
					throw error;
				}
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError("IP with this name already exists");
				}
				throw new UnexpectedError("Failed to update IP", error);
			}
		},

		async delete(id: string, tx?: unknown): Promise<void> {
			const rows = await getExecutor(tx).delete(ips).where(eq(ips.id, id)).returning();
			if (!rows[0]) {
				throw new ResourceNotFoundError("IP", id);
			}
		},

		async findByMediaId(mediaId: string, tx?: unknown): Promise<Ip[]> {
			const query = getExecutor(tx)
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
			const rows = options.orderByName ? await query.orderBy(asc(ips.name)) : await query;
			return rows.map(mapToIp);
		},

		async getMediaIps(mediaId: string, tx?: unknown): Promise<IpWithAssociation[]> {
			const query = getExecutor(tx)
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
			const rows = options.orderByName ? await query.orderBy(asc(ips.name)) : await query;

			return rows.map((row) => ({
				...mapToIp(row),
				confidence: row.confidence,
				associationSource: row.associationSource,
			}));
		},

		async addMedia(
			mediaId: string,
			ipId: string,
			confidence?: number,
			source = "manual",
			tx?: unknown,
		): Promise<void> {
			await getExecutor(tx)
				.insert(mediaIps)
				.values({
					mediaId,
					ipId,
					confidence: confidence ?? null,
					source,
				})
				.onConflictDoUpdate({
					target: [mediaIps.mediaId, mediaIps.ipId],
					set: mediaIpConflictSet(source),
				});
		},

		async removeMedia(mediaId: string, ipId: string, tx?: unknown): Promise<void> {
			const rows = await getExecutor(tx)
				.delete(mediaIps)
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
			tx?: unknown,
		): Promise<void> {
			if (ipsData.length === 0) {
				return;
			}

			await getExecutor(tx)
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
					set: mediaIpConflictSet(source),
				});
		},
	};
}
