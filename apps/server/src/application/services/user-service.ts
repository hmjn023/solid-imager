import { createUserService } from "@solid-imager/application/services/user-service";
import type {
	NewUser,
	UpdateUser,
} from "@solid-imager/core/domain/users/schemas";
import { UserRepository } from "~/infrastructure/repositories/user-repository";

const userService = createUserService(UserRepository);

export const UserService = {
	list: async () => await userService.list(),

	create: async (userData: NewUser) => await userService.create(userData),

	get: async (userId: string) => await userService.get(userId),

	update: async (userId: string, userData: UpdateUser) =>
		await userService.update(userId, userData),

	delete: async (userId: string) => {
		await userService.delete(userId);
		return { success: true };
	},
};
