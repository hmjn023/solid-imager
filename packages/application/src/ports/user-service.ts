import type {
  NewUser,
  User,
  UpdateUser,
} from "@solid-imager/core/domain/users/schemas";

export interface IUserService {
  getAllUsers(): Promise<User[]>;
  createUser(userData: NewUser): Promise<User>;
  getUserDetails(userId: string): Promise<User | undefined>;
  updateUser(userId: string, userData: UpdateUser): Promise<User>;
  deleteUser(userId: string): Promise<{ success: true }>;
}
