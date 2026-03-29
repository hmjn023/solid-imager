import type {
	NewUser,
	UpdateUser,
} from "@solid-imager/core/domain/users/schemas";
import { UserRepository } from "~/infrastructure/repositories/user-repository";

export const UserService = {
	getAllUsers: async () => await UserRepository.findAll(),

	createUser: async (userData: NewUser) =>
		await UserRepository.create(userData),

	getUserDetails: async (userId: string) =>
		await UserRepository.findById(userId),

	updateUser: async (userId: string, userData: UpdateUser) =>
		await UserRepository.update(userId, userData),

	deleteUser: async (userId: string) => {
		await UserRepository.delete(userId);
		return { success: true };
	},
};
