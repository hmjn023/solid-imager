import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { characters } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";

export const selectCharacters = async () => {
  try {
    return await db.select().from(characters);
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to select characters",
      details: error,
    });
  }
};

export const insertCharacter = async (characterData: unknown) => {
  try {
    return await db.insert(characters).values(characterData).returning();
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Character with this name and IP already exists",
        details: error,
      });
    }
    throw new UnknownDbError({
      message: "Failed to insert character",
      details: error,
    });
  }
};

export const selectCharacterById = async (characterId: number) => {
  try {
    const result = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Character with ID ${characterId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select character by ID: ${characterId}`,
      details: error,
    });
  }
};

export const updateCharacter = async (
  characterId: number,
  characterData: unknown
) => {
  try {
    const result = await db

      .update(characters)

      .set(characterData)

      .where(eq(characters.id, characterId))

      .returning();

    if (result.length === 0) {
      throw new NotFoundError({
        message: `Character with ID ${characterId} not found`,
      });
    }

    return result[0];
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new ConstraintError({
        message: "Character with this name and IP already exists",

        details: error,
      });
    }

    throw new UnknownDbError({
      message: `Failed to update character with ID: ${characterId}`,

      details: error,
    });
  }
};

export const deleteCharacter = async (characterId: number) => {
  try {
    const result = await db
      .delete(characters)
      .where(eq(characters.id, characterId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Character with ID ${characterId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to delete character with ID: ${characterId}`,
      details: error,
    });
  }
};
