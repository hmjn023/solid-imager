import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type { NewUser, UpdateUser, User } from "@/domain/users/schemas";

export type { NewUser, UpdateUser, User } from "@/domain/users/schemas";

export type UserRepository = {
	findAll(): Promise<User[]>;
	findById(id: string, tx?: Transaction): Promise<User | null>;
	findByEmail(email: string, tx?: Transaction): Promise<User | null>;
	create(user: NewUser, tx?: Transaction): Promise<User>;
	update(id: string, user: UpdateUser, tx?: Transaction): Promise<User>;
	delete(id: string, tx?: Transaction): Promise<void>;
};
