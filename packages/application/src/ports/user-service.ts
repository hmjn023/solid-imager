import type { NewUser, UpdateUser, User } from "@solid-imager/core/users";

/** Manages user records and returns undefined when a user is absent. */
export interface IUserService {
	getAllUsers(): Promise<User[]>;
	createUser(userData: NewUser): Promise<User>;
	getUserDetails(userId: string): Promise<User | undefined>;
	updateUser(userId: string, userData: UpdateUser): Promise<User>;
	deleteUser(userId: string): Promise<{ success: true }>;
}
