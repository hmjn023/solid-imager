import type { UserRepository as UserRepositoryDef } from "@solid-imager/core/domain/repositories/user-repository";
import { createUserRepository } from "@solid-imager/db/repositories/user-repository";
import { getExecutor } from "~/infrastructure/db/executor";

export const UserRepository: UserRepositoryDef = createUserRepository(getExecutor);
