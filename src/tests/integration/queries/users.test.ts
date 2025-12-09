import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteUser,
  insertUser,
  selectUserById,
  selectUsers,
  updateUser,
} from "~/infrastructure/db/queries/users";
import { type NewUser, users } from "~/infrastructure/db/schema";

describe("users queries Integration", () => {
  let testUserId: string;

  beforeAll(async () => {
    await db.delete(users);

    const initialUser: NewUser = {
      name: "Initial User",
      email: "initial@test.com",
      password: "password123",
    };
    const inserted = await db.insert(users).values(initialUser).returning();
    testUserId = inserted[0].id;
  });

  afterAll(async () => {
    await db.delete(users);
  });

  it("should select all users", async () => {
    const result = await selectUsers();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should select a user by their ID", async () => {
    const user = await selectUserById(testUserId);
    expect(user).toBeDefined();
    expect(user.id).toBe(testUserId);
  });

  it("should throw NotFoundError when selecting a non-existent user", async () => {
    const nonExistentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
    await expect(selectUserById(nonExistentId)).rejects.toThrow(NotFoundError);
  });

  it("should insert a new user", async () => {
    const newUser: NewUser = {
      name: "New User",
      email: "new@test.com",
      password: "pw",
    };
    const inserted = await insertUser(newUser);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newUser.name);

    const selected = await selectUserById(inserted[0].id);
    expect(selected).toBeDefined();

    await deleteUser(inserted[0].id);
  });

  it("should update an existing user", async () => {
    const updatedName = "Updated User Name";
    const updated = await updateUser(testUserId, { name: updatedName });
    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);

    const selected = await selectUserById(testUserId);
    expect(selected.name).toBe(updatedName);
  });

  it("should delete a user", async () => {
    const userToDelete: NewUser = {
      name: "Delete Me",
      email: "del@test.com",
      password: "pw",
    };
    const inserted = await insertUser(userToDelete);
    const insertedId = inserted[0].id;

    await deleteUser(insertedId);

    await expect(selectUserById(insertedId)).rejects.toThrow(NotFoundError);
  });
});
