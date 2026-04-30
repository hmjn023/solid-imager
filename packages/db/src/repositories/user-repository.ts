import {
	ResourceConflictError,
	ResourceNotFoundError,
	UnexpectedError,
} from "@solid-imager/core/domain/errors";
import type {
	NewUser,
	UpdateUser,
	User,
	UserRepository,
} from "@solid-imager/core/domain/repositories/user-repository";
import { userSchema } from "@solid-imager/core/domain/users/schemas";
import { asc, eq } from "drizzle-orm";
import { users } from "../schema";
import type { DrizzleExecutor } from "../types";

type DbUser = typeof users.$inferSelect;

export type UserRepositoryExecutorProvider = (tx?: unknown) => DrizzleExecutor;

type CreateUserRepositoryOptions = {
	orderByName?: boolean;
};

function isUniqueViolation(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "23505"
	);
}

function mapToUser(row: DbUser): User | null {
	const result = userSchema.safeParse({
		id: row.id,
		name: row.name,
		email: row.email,
		password: row.password,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});
	return result.success ? result.data : null;
}

export function createUserRepository(
	getExecutor: UserRepositoryExecutorProvider,
	options: CreateUserRepositoryOptions = {},
): UserRepository {
	return {
		async findAll(): Promise<User[]> {
			try {
				const query = getExecutor().select().from(users);
				const rows = options.orderByName
					? await query.orderBy(asc(users.name))
					: await query;
				return rows.flatMap((row) => {
					const mapped = mapToUser(row);
					return mapped ? [mapped] : [];
				});
			} catch (error) {
				throw new UnexpectedError("Failed to select users", error);
			}
		},

		async findById(id: string, tx?: unknown): Promise<User | null> {
			try {
				const rows = await getExecutor(tx)
					.select()
					.from(users)
					.where(eq(users.id, id))
					.limit(1);
				return rows[0] ? mapToUser(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(`Failed to select user by ID: ${id}`, error);
			}
		},

		async findByEmail(email: string, tx?: unknown): Promise<User | null> {
			try {
				const rows = await getExecutor(tx)
					.select()
					.from(users)
					.where(eq(users.email, email))
					.limit(1);
				return rows[0] ? mapToUser(rows[0]) : null;
			} catch (error) {
				throw new UnexpectedError(
					`Failed to select user by email: ${email}`,
					error,
				);
			}
		},

		async create(input: NewUser, tx?: unknown): Promise<User> {
			try {
				const rows = await getExecutor(tx)
					.insert(users)
					.values({
						name: input.name,
						email: input.email,
						password: input.password,
					})
					.returning();
				const mapped = mapToUser(rows[0]);
				if (!mapped) {
					throw new UnexpectedError("Failed to parse created user");
				}
				return mapped;
			} catch (error) {
				if (error instanceof UnexpectedError) throw error;
				if (isUniqueViolation(error)) {
					throw new ResourceConflictError(
						"User with this email already exists",
					);
				}
				throw new UnexpectedError("Failed to insert user", error);
			}
		},

		async update(id: string, input: UpdateUser, tx?: unknown): Promise<User> {
			try {
				const rows = await getExecutor(tx)
					.update(users)
					.set({
						...(input.name !== undefined ? { name: input.name } : {}),
						...(input.email !== undefined ? { email: input.email } : {}),
						...(input.password !== undefined
							? { password: input.password }
							: {}),
						updatedAt: new Date(),
					})
					.where(eq(users.id, id))
					.returning();

				if (!rows[0]) {
					throw new ResourceNotFoundError("User", id);
				}
				const mapped = mapToUser(rows[0]);
				if (!mapped) {
					throw new UnexpectedError("Failed to parse updated user");
				}
				return mapped;
			} catch (error) {
				if (
					error instanceof ResourceNotFoundError ||
					error instanceof UnexpectedError
				) {
					throw error;
				}
				if (isUniqueViolation(error)) {
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

		async delete(id: string, tx?: unknown): Promise<void> {
			try {
				const rows = await getExecutor(tx)
					.delete(users)
					.where(eq(users.id, id))
					.returning();

				if (!rows[0]) {
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
