import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { ips } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

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

export const insertIp = async (ipData: unknown) => {
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

export const updateIp = async (ipId: number, ipData: unknown) => {
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
