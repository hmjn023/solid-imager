import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { users } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all users from the database.
 * @returns {Promise<User[]>} A promise that resolves with an array of user objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Inserts a new user into the database.
 * @param {unknown} userData - The data for the new user.
 * @returns {Promise<User[]>} A promise that resolves with an array containing the newly inserted user.
 * @throws {ConstraintError} If a user with the same email already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
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

/**
 * Selects a user by their ID from the database.
 * @param {string} userId - The ID of the user to select.
 * @returns {Promise<User>} A promise that resolves with the user object.
 * @throws {NotFoundError} If no user with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Updates an existing user in the database.
 * @param {string} userId - The ID of the user to update.
 * @param {unknown} userData - The partial data to update the user with.
 * @returns {Promise<User>} A promise that resolves with the updated user object.
 * @throws {NotFoundError} If no user with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate email).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
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

/**
 * Deletes a user from the database.
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<User>} A promise that resolves with the deleted user object.
 * @throws {NotFoundError} If no user with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
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
