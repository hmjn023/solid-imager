import type { IUserService } from "../ports/user-service";
import type { User, NewUser, UpdateUser } from "@solid-imager/core/domain/repositories/user-repository";

export function createUserService(
  repo: {
    findAll(): Promise<User[]>;
    create(data: NewUser): Promise<User>;
    findById(id: string): Promise<User | null>;
    update(id: string, data: UpdateUser): Promise<User>;
    delete(id: string): Promise<void>;
  },
): IUserService {
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
