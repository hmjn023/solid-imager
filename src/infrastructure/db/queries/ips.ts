import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { ips, mediaIps, type NewIp } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all Intellectual Properties (IPs) from the database.
 * @returns {Promise<Ip[]>} A promise that resolves with an array of IP objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectIps = async () => {
  try {
    return await db.select().from(ips);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select IPs",
      details: error,
    });
  }
};

/**
 * Inserts a new Intellectual Property (IP) into the database.
 * @param {NewIp} ipData - The data for the new IP.
 * @returns {Promise<Ip[]>} A promise that resolves with an array containing the newly inserted IP.
 * @throws {ConstraintError} If an IP with the same name already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
export const insertIp = async (ipData: NewIp) => {
  try {
    return await db.insert(ips).values(ipData).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "IP with this name already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert IP",
      details: error,
    });
  }
};

/**
 * Selects an Intellectual Property (IP) by its ID from the database.
 * @param {number} ipId - The ID of the IP to select.
 * @returns {Promise<Ip>} A promise that resolves with the IP object.
 * @throws {NotFoundError} If no IP with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectIpById = async (ipId: number) => {
  try {
    const result = await db.select().from(ips).where(eq(ips.id, ipId));
    if (result.length === 0) {
      throw new NotFoundError({ message: `IP with ID ${ipId} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select IP by ID: ${ipId}`,
      details: error,
    });
  }
};

/**
 * Updates an existing Intellectual Property (IP) in the database.
 * @param {number} ipId - The ID of the IP to update.
 * @param {Partial<NewIp>} ipData - The partial data to update the IP with.
 * @returns {Promise<Ip>} A promise that resolves with the updated IP object.
 * @throws {NotFoundError} If no IP with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate name).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateIp = async (ipId: number, ipData: Partial<NewIp>) => {
  try {
    const result = await db
      .update(ips)
      .set(ipData)
      .where(eq(ips.id, ipId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `IP with ID ${ipId} not found` });
    }
    return result[0];
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "IP with this name already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: `Failed to update IP with ID: ${ipId}`,
      details: error,
    });
  }
};

/**
 * Deletes an Intellectual Property (IP) from the database.
 * @param {number} ipId - The ID of the IP to delete.
 * @returns {Promise<Ip>} A promise that resolves with the deleted IP object.
 * @throws {NotFoundError} If no IP with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteIp = async (ipId: number) => {
  try {
    const result = await db.delete(ips).where(eq(ips.id, ipId)).returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `IP with ID ${ipId} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete IP with ID: ${ipId}`,
      details: error,
    });
  }
};

export async function selectIpsByMediaId(mediaId: string) {
  try {
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
    return result;
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to select ips by media id" });
  }
}

export async function insertMediaIp(
  mediaId: string,
  ipId: number,
  source = "manual"
) {
  try {
    const result = await db
      .insert(mediaIps)
      .values({ mediaId, ipId, source })
      .returning();
    return result[0];
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to insert media ip" });
  }
}

export async function deleteMediaIp(mediaId: string, ipId: number) {
  try {
    const result = await db
      .delete(mediaIps)
      .where(and(eq(mediaIps.mediaId, mediaId), eq(mediaIps.ipId, ipId)))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `MediaIp with mediaId ${mediaId} and ipId ${ipId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: "Failed to delete media ip" });
  }
}
