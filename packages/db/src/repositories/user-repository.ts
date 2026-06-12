import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type {
  NewUser,
  UpdateUser,
  User,
  UserRepository as UserRepositoryDef,
} from "@solid-imager/core/domain/repositories/user-repository";
import { eq } from "drizzle-orm";
import { users } from "../schema";
import type { DrizzleExecutor } from "../types";

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createUserRepository(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
): UserRepositoryDef {
  return {
    async findAll(): Promise<User[]> {
      try {
        const results = await getExecutor().select().from(users);
        return results.map(mapUser);
      } catch (error) {
        throw new UnexpectedError("Failed to select users", error);
      }
    },

    async findById(id: string): Promise<User | null> {
      try {
        const result = await getExecutor()
          .select()
          .from(users)
          .where(eq(users.id, id));
        if (result.length === 0) {
          return null;
        }
        return mapUser(result[0]);
      } catch (error) {
        throw new UnexpectedError(
          `Failed to select user by ID: ${id}`,
          error,
        );
      }
    },

    async findByEmail(email: string): Promise<User | null> {
      try {
        const result = await getExecutor()
          .select()
          .from(users)
          .where(eq(users.email, email));
        if (result.length === 0) {
          return null;
        }
        return mapUser(result[0]);
      } catch (error) {
        throw new UnexpectedError(
          `Failed to select user by email: ${email}`,
          error,
        );
      }
    },

    async create(user: NewUser): Promise<User> {
      try {
        const result = await getExecutor()
          .insert(users)
          .values(user)
          .returning();
        return mapUser(result[0]);
      } catch (error: unknown) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw new ResourceConflictError(
            "User with this email already exists",
          );
        }
        throw new UnexpectedError("Failed to insert user", error);
      }
    },

    async update(id: string, user: UpdateUser): Promise<User> {
      try {
        const result = await getExecutor()
          .update(users)
          .set(user)
          .where(eq(users.id, id))
          .returning();

        if (result.length === 0) {
          throw new ResourceNotFoundError("User", id);
        }
        return mapUser(result[0]);
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
          throw new ResourceConflictError(
            "User with this email already exists",
          );
        }
        throw new UnexpectedError(
          `Failed to update user with ID: ${id}`,
          error,
        );
      }
    },

    async delete(id: string): Promise<void> {
      try {
        const result = await getExecutor()
          .delete(users)
          .where(eq(users.id, id))
          .returning();

        if (result.length === 0) {
          throw new ResourceNotFoundError("User", id);
        }
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          throw error;
        }
        throw new UnexpectedError(
          `Failed to delete user with ID: ${id}`,
          error,
        );
      }
    },
  };
}
