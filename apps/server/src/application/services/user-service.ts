import { createUserService } from "@solid-imager/application/services/user-service";
import type {
	NewUser,
	UpdateUser,
} from "@solid-imager/core/domain/users/schemas";
import { UserRepository } from "~/infrastructure/repositories/user-repository";

const userService = createUserService(UserRepository);

export const UserService = {
	getAllUsers: async () => await userService.getAllUsers(),

	createUser: async (userData: NewUser) =>
		await userService.createUser(userData),

	getUserDetails: async (userId: string) =>
		await userService.getUserDetails(userId),

	updateUser: async (userId: string, userData: UpdateUser) =>
		await userService.updateUser(userId, userData),

	deleteUser: async (userId: string) => {
		await userService.deleteUser(userId);
		return { success: true };
	},
};
