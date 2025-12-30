import { and, eq } from "drizzle-orm";
import type { Ip, NewIp, UpdateIp } from "~/domain/ips/schemas";
import type { IIpRepository } from "~/domain/repositories/ip.repository";
import { db } from "~/infrastructure/db";
import { ConstraintError, NotFoundError } from "~/infrastructure/db/errors";
import { ips, mediaIps } from "~/infrastructure/db/schema";

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

  async findById(id: string): Promise<Ip | null> {
    const result = await db.select().from(ips).where(eq(ips.id, id));
    return result[0] ? mapToDomain(result[0]) : null;
  },

  async create(ip: NewIp): Promise<Ip> {
    try {
      const result = await db.insert(ips).values(ip).returning();
      return mapToDomain(result[0]);
    } catch (error: unknown) {
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ConstraintError({
          message: "IP with this name already exists",
          details: error,
        });
      }
      throw error;
    }
  },

  async update(id: string, ip: UpdateIp): Promise<Ip> {
    try {
      const result = await db
        .update(ips)
        .set({ ...ip, updatedAt: new Date() })
        .where(eq(ips.id, id))
        .returning();

      if (!result[0]) {
        throw new NotFoundError({ message: `IP with ID ${id} not found` });
      }
      return mapToDomain(result[0]);
    } catch (error: unknown) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      // biome-ignore lint/suspicious/noExplicitAny: Checking error code on unknown error
      if ((error as any).code === "23505") {
        throw new ConstraintError({
          message: "IP with this name already exists",
          details: error,
        });
      }
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    const result = await db.delete(ips).where(eq(ips.id, id)).returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `IP with ID ${id} not found` });
    }
  },

  async findByMediaId(mediaId: string): Promise<Ip[]> {
    const result = await db
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

    return result.map((i) => ({
      ...i,
      createdAt: i.createdAt || new Date(),
      updatedAt: i.updatedAt || new Date(),
    }));
  },

  async addMedia(mediaId: string, ipId: string): Promise<void> {
    await db.insert(mediaIps).values({ mediaId, ipId }).returning();
  },

  async removeMedia(mediaId: string, ipId: string): Promise<void> {
    const result = await db
      .delete(mediaIps)
      .where(and(eq(mediaIps.mediaId, mediaId), eq(mediaIps.ipId, ipId)))
      .returning();

    if (result.length === 0) {
      throw new NotFoundError({
        message: `MediaIp with mediaId ${mediaId} and ipId ${ipId} not found`,
      });
    }
  },
};
