import { createUserService } from "@solid-imager/application/services/user-service";
import type { NewUser, UpdateUser, User } from "@solid-imager/core/domain/users/schemas";
import { TauriUserRepository } from "../repositories/user-repository";

const userService = createUserService(TauriUserRepository);

export const TauriUserService = {
	async list(): Promise<User[]> {
		return await userService.getAllUsers();
	},

	async get(id: string): Promise<User | null> {
		return await userService.getUserDetails(id);
	},

	async create(input: NewUser): Promise<User> {
		return await userService.createUser(input);
	},

	async update(id: string, input: UpdateUser): Promise<User> {
		return await userService.updateUser(id, input);
	},

	async delete(id: string): Promise<void> {
		await userService.deleteUser(id);
	},
};
