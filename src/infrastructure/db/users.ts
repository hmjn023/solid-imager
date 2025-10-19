import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { users } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";

export const selectUsers = async () => {
  try {
    return await db.select().from(users);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select users",
      details: error,
    });
  }
};

export const insertUser = async (userData: unknown) => {
  try {
    return await db.insert(users).values(userData).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "User with this email already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert user",
      details: error,
    });
  }
};

export const selectUserById = async (userId: string) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, userId));
    if (result.length === 0) {
      throw new NotFoundError({ message: `User with ID ${userId} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select user by ID: ${userId}`,
      details: error,
    });
  }
};

export const updateUser = async (userId: string, userData: unknown) => {
  try {
    const result = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, userId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `User with ID ${userId} not found` });
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
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "User with this email already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: `Failed to update user with ID: ${userId}`,
      details: error,
    });
  }
};

export const deleteUser = async (userId: string) => {
  try {
    const result = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({ message: `User with ID ${userId} not found` });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete user with ID: ${userId}`,
      details: error,
    });
  }
};
