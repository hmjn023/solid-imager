import { cache } from "@solidjs/router";
import type { NewUser, UpdateUser } from "~/domain/users/schemas";
import { UserRepository } from "~/infrastructure/repositories/user-repository";

export const UserService = {
  getAllUsers: cache(async () => {
    "use server";
    return await UserRepository.findAll();
  }, "getAllUsers"),

  createUser: async (userData: NewUser) => {
    "use server";
    return await UserRepository.create(userData);
  },

  getUserDetails: cache(async (userId: string) => {
    "use server";
    return await UserRepository.findById(userId);
  }, "getUserDetails"),

  updateUser: async (userId: string, userData: UpdateUser) => {
    "use server";
    return await UserRepository.update(userId, userData);
  },

  deleteUser: async (userId: string) => {
    "use server";
    await UserRepository.delete(userId);
    return { success: true };
  },
};
