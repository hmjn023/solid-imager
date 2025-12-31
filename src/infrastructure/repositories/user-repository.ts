import { eq } from "drizzle-orm";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnexpectedError,
} from "~/domain/errors";
import type {
  NewUser,
  UpdateUser,
  User,
  UserRepository as UserRepositoryDef,
} from "~/domain/repositories/user-repository";
import { db } from "~/infrastructure/db/index";
import { users } from "~/infrastructure/db/schema";

export class DrizzleUserRepository implements UserRepositoryDef {
  async findAll(): Promise<User[]> {
    try {
      const results = await db.select().from(users);
      return results as unknown as User[];
    } catch (error) {
      throw new UnexpectedError("Failed to select users", error);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      if (result.length === 0) {
        return null;
      }
      return result[0] as unknown as User;
    } catch (error) {
      throw new UnexpectedError(`Failed to select user by ID: ${id}`, error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      if (result.length === 0) {
        return null;
      }
      return result[0] as unknown as User;
    } catch (error) {
      throw new UnexpectedError(
        `Failed to select user by email: ${email}`,
        error
      );
    }
  }

  async create(user: NewUser): Promise<User> {
    try {
      const result = await db.insert(users).values(user).returning();
      return result[0] as unknown as User;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError("User with this email already exists");
      }
      throw new UnexpectedError("Failed to insert user", error);
    }
  }

  async update(id: string, user: UpdateUser): Promise<User> {
    try {
      const result = await db
        .update(users)
        .set(user)
        .where(eq(users.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("User", id);
      }
      return result[0] as unknown as User;
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError("User with this email already exists");
      }
      throw new UnexpectedError(`Failed to update user with ID: ${id}`, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await db.delete(users).where(eq(users.id, id)).returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("User", id);
      }
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      throw new UnexpectedError(`Failed to delete user with ID: ${id}`, error);
    }
  }
}

export const UserRepository = new DrizzleUserRepository();
