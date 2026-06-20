import type { UserRepository } from "@solid-imager/core/domain/repositories/user-repository";
import type {
	NewUser,
	UpdateUser,
} from "@solid-imager/core/domain/users/schemas";
import type { IUserService } from "../ports/user-service";

export function createUserService(repo: UserRepository): IUserService {
	return {
		getAllUsers: () => repo.findAll(),
		createUser: (data: NewUser) => repo.create(data),
		getUserDetails: async (id: string) => {
			const result = await repo.findById(id);
			return result ?? undefined;
		},
		updateUser: (id: string, data: UpdateUser) => repo.update(id, data),
		deleteUser: async (id: string) => {
			await repo.delete(id);
			return { success: true as const };
		},
	};
}
