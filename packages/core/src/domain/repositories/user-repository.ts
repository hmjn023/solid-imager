import type { NewUser, UpdateUser, User } from "@/domain/users/schemas";

export type { NewUser, UpdateUser, User } from "@/domain/users/schemas";

export type UserRepository = {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  update(id: string, user: UpdateUser): Promise<User>;
  delete(id: string): Promise<void>;
};
