import { and, eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { characters, mediaCharacters } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "../errors";

/**
 * Selects all characters from the database.
 * @returns {Promise<Character[]>} A promise that resolves with an array of character objects.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
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

/**
 * Inserts a new character into the database.
 * @param {unknown} characterData - The data for the new character.
 * @returns {Promise<Character[]>} A promise that resolves with an array containing the newly inserted character.
 * @throws {ConstraintError} If a character with the same name and IP already exists.
 * @throws {UnknownDbError} If a database error occurs during the insertion.
 */
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

/**
 * Selects a character by its ID from the database.
 * @param {string} characterId - The ID of the character to select.
 * @returns {Promise<typeof characters.$inferSelect>} A promise that resolves with the character object.
 * @throws {NotFoundError} If no character with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the selection.
 */
export const selectCharacterById = async (characterId: string) => {
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

/**
 * Updates an existing character in the database.
 * @param {string} characterId - The ID of the character to update.
 * @param {unknown} characterData - The partial data to update the character with.
 * @returns {Promise<typeof characters.$inferSelect>} A promise that resolves with the updated character object.
 * @throws {NotFoundError} If no character with the given ID is found.
 * @throws {ConstraintError} If the update causes a unique constraint violation (e.g., duplicate name and IP).
 * @throws {UnknownDbError} If a database error occurs during the update.
 */
export const updateCharacter = async (
  characterId: string,
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

/**
 * Deletes a character from the database.
 * @param {string} characterId - The ID of the character to delete.
 * @returns {Promise<typeof characters.$inferSelect>} A promise that resolves with the deleted character object.
 * @throws {NotFoundError} If no character with the given ID is found.
 * @throws {UnknownDbError} If a database error occurs during the deletion.
 */
export const deleteCharacter = async (characterId: string) => {
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

export async function selectCharactersByMediaId(mediaId: string) {
  try {
    const result = await db
      .select({
        id: characters.id,
        name: characters.name,
        ipId: characters.ipId,
        description: characters.description,
        source: characters.source,
        aliases: characters.aliases,
        createdAt: characters.createdAt,
        updatedAt: characters.updatedAt,
      })
      .from(characters)
      .innerJoin(
        mediaCharacters,
        eq(characters.id, mediaCharacters.characterId)
      )
      .where(eq(mediaCharacters.mediaId, mediaId));
    return result;
  } catch (_error) {
    throw new UnknownDbError({
      message: "Failed to select characters by media id",
    });
  }
}

export async function insertMediaCharacter(
  mediaId: string,
  characterId: string
) {
  try {
    const result = await db
      .insert(mediaCharacters)
      .values({ mediaId, characterId })
      .returning();
    return result[0];
  } catch (_error) {
    throw new UnknownDbError({ message: "Failed to insert media character" });
  }
}

export async function deleteMediaCharacter(
  mediaId: string,
  characterId: string
) {
  try {
    const result = await db
      .delete(mediaCharacters)
      .where(
        and(
          eq(mediaCharacters.mediaId, mediaId),
          eq(mediaCharacters.characterId, characterId)
        )
      )
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `MediaCharacter with mediaId ${mediaId} and characterId ${characterId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({ message: "Failed to delete media character" });
  }
}
