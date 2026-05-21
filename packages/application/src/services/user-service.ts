import type { UserRepository } from "@solid-imager/core/domain/repositories/user-repository";
import type {
	NewUser,
	UpdateUser,
	User,
} from "@solid-imager/core/domain/users/schemas";

export type UserService = ReturnType<typeof createUserService>;

export function createUserService(repository: UserRepository) {
	return {
		async list(): Promise<User[]> {
			return await repository.findAll();
		},

		async get(id: string): Promise<User | null> {
			return await repository.findById(id);
		},

		async create(input: NewUser): Promise<User> {
			return await repository.create(input);
		},

		async update(id: string, input: UpdateUser): Promise<User> {
			return await repository.update(id, input);
		},

		async delete(id: string): Promise<void> {
			await repository.delete(id);
		},
	};
}
