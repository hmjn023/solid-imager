import type { UserRepository as UserRepositoryDef } from "@solid-imager/core/domain/repositories/user-repository";
import { createUserRepository } from "@solid-imager/db/repositories/user-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export const UserRepository: UserRepositoryDef = createUserRepository(
	(tx) => (tx ?? db) as DrizzleExecutor,
);
