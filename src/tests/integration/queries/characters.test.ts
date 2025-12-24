import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteCharacter,
  insertCharacter,
  selectCharacterById,
  selectCharacters,
  updateCharacter,
} from "~/infrastructure/db/queries/characters";
import {
  characters,
  ips,
  type NewCharacter,
  type NewIp,
} from "~/infrastructure/db/schema";

describe("characters queries Integration", () => {
  let testIpId: string;
  let testCharacterId: string;

  beforeAll(async () => {
    // Clean up
    await db.delete(characters);
    await db.delete(ips);

    // Seed IP
    const initialIp: NewIp = { name: "Test IP for Character" };
    const insertedIp = await db.insert(ips).values(initialIp).returning();
    testIpId = insertedIp[0].id;

    // Seed Character
    const initialCharacter: NewCharacter = {
      name: "Initial Character",
      ipId: testIpId,
    };
    const insertedCharacter = await db
      .insert(characters)
      .values(initialCharacter)
      .returning();
    testCharacterId = insertedCharacter[0].id;
  });

  afterAll(async () => {
    // Clean up
    await db.delete(characters);
    await db.delete(ips);
  });

  it("should select all characters", async () => {
    const result = await selectCharacters();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should select a character by its ID", async () => {
    const character = await selectCharacterById(testCharacterId);
    expect(character).toBeDefined();
    expect(character.id).toBe(testCharacterId);
    expect(character.name).toBe("Initial Character");
    expect(character.ipId).toBe(testIpId);
  });

  it("should throw NotFoundError when selecting a non-existent character", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    await expect(selectCharacterById(nonExistentId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should insert a new character", async () => {
    const newCharacter: NewCharacter = {
      name: "New Test Character",
      ipId: testIpId,
    };
    const inserted = await insertCharacter(newCharacter);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newCharacter.name);

    // Verify in DB
    const selected = await selectCharacterById(inserted[0].id);
    expect(selected).toBeDefined();

    // Cleanup
    await deleteCharacter(inserted[0].id);
  });

  it("should update an existing character", async () => {
    const updatedName = "Updated Character Name";
    const updated = await updateCharacter(testCharacterId, {
      name: updatedName,
    });
    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);

    // Verify in DB
    const selected = await selectCharacterById(testCharacterId);
    expect(selected.name).toBe(updatedName);
  });

  it("should delete a character", async () => {
    const characterToDelete: NewCharacter = {
      name: "To Be Deleted",
      ipId: testIpId,
    };
    const inserted = await insertCharacter(characterToDelete);
    const insertedId = inserted[0].id;

    await deleteCharacter(insertedId);

    // Verify it's gone
    await expect(selectCharacterById(insertedId)).rejects.toThrow(
      NotFoundError
    );
  });
});
