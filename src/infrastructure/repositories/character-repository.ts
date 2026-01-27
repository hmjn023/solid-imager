import { and, eq, sql } from "drizzle-orm";
import type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnexpectedError,
} from "~/domain/errors";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import { db, type TransactionClient } from "~/infrastructure/db/index";
import { characters, mediaCharacters } from "~/infrastructure/db/schema";

export class DrizzleCharacterRepository implements CharacterRepository {
  async findAll(): Promise<Character[]> {
    try {
      const results = await db.select().from(characters);
      return results as Character[];
    } catch (error) {
      throw new UnexpectedError("Failed to select characters", error);
    }
  }

  async findById(id: string, tx?: Transaction): Promise<Character | null> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .select()
        .from(characters)
        .where(eq(characters.id, id));
      if (result.length === 0) {
        return null;
      }
      return result[0] as Character;
    } catch (error) {
      throw new UnexpectedError(
        `Failed to select character by ID: ${id}`,
        error
      );
    }
  }

  async findByName(name: string, tx?: Transaction): Promise<Character | null> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .select()
        .from(characters)
        .where(eq(characters.name, name));
      if (result.length === 0) {
        return null;
      }
      return result[0] as Character;
    } catch (error) {
      throw new UnexpectedError(
        `Failed to select character by name: ${name}`,
        error
      );
    }
  }

  async create(character: NewCharacter, tx?: Transaction): Promise<Character> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .insert(characters)
        .values({
          ...character,
          description: character.description ?? "",
        })
        .returning();
      return result[0] as Character;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError(
          "Character with this name already exists in this IP"
        );
      }
      throw new UnexpectedError("Failed to insert character", error);
    }
  }

  async update(
    id: string,
    character: UpdateCharacter,
    tx?: Transaction
  ): Promise<Character> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .update(characters)
        .set({
          ...character,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Character", id);
      }
      return result[0] as Character;
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError(
          "Character with this name already exists in this IP"
        );
      }
      throw new UnexpectedError(
        `Failed to update character with ID: ${id}`,
        error
      );
    }
  }

  async delete(id: string, tx?: Transaction): Promise<void> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .delete(characters)
        .where(eq(characters.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Character", id);
      }
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      throw new UnexpectedError(
        `Failed to delete character with ID: ${id}`,
        error
      );
    }
  }

  async findByMediaId(mediaId: string, tx?: Transaction): Promise<Character[]> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const results = await client
        .select({
          id: characters.id,
          name: characters.name,
          description: characters.description,
          ipId: characters.ipId,
          createdAt: characters.createdAt,
          updatedAt: characters.updatedAt,
        })
        .from(characters)
        .innerJoin(
          mediaCharacters,
          eq(characters.id, mediaCharacters.characterId)
        )
        .where(eq(mediaCharacters.mediaId, mediaId));
      return results as Character[];
    } catch (error) {
      throw new UnexpectedError(
        `Failed to find characters for media: ${mediaId}`,
        error
      );
    }
  }

  async getMediaCharacters(
    mediaId: string,
    tx?: Transaction
  ): Promise<
    (Character & { confidence: number | null; associationSource: string })[]
  > {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const results = await client
        .select({
          id: characters.id,
          name: characters.name,
          description: characters.description,
          ipId: characters.ipId,
          createdAt: characters.createdAt,
          updatedAt: characters.updatedAt,
          source: characters.source,
          aliases: characters.aliases,
          confidence: mediaCharacters.confidence,
          associationSource: mediaCharacters.source,
        })
        .from(characters)
        .innerJoin(
          mediaCharacters,
          eq(characters.id, mediaCharacters.characterId)
        )
        .where(eq(mediaCharacters.mediaId, mediaId));
      return results as (Character & {
        confidence: number | null;
        associationSource: string;
      })[];
    } catch (error) {
      throw new UnexpectedError(
        `Failed to find media characters for media: ${mediaId}`,
        error
      );
    }
  }

  // biome-ignore lint/nursery/useMaxParams: Repo method
  async addToMedia(
    mediaId: string,
    characterId: string,
    confidence?: number,
    source = "manual",
    tx?: Transaction
  ): Promise<void> {
    try {
      const client = (tx as unknown as TransactionClient) || db;

      let sourceUpdateSql = sql`excluded.source`;
      let confidenceUpdateSql = sql`excluded.confidence`;

      if (source === "AI") {
        // Only update if current is 'AI'
        sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
        confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
      } else if (source === "manual") {
        // Update if current is 'AI' or 'manual' (always update basically, unless we have higher prio than manual which we don't for chars yet)
        // Assuming manual is highest priority for characters for now.
        sourceUpdateSql = sql`excluded.source`;
        confidenceUpdateSql = sql`excluded.confidence`;
      }

      await client
        .insert(mediaCharacters)
        .values({
          mediaId,
          characterId,
          confidence: confidence ?? null,
          source,
        })
        .onConflictDoUpdate({
          target: [mediaCharacters.mediaId, mediaCharacters.characterId],
          set: {
            confidence: confidenceUpdateSql,
            source: sourceUpdateSql,
          },
        });
    } catch (error: unknown) {
      throw new UnexpectedError(
        `Failed to add character ${characterId} to media ${mediaId}`,
        error
      );
    }
  }

  async removeFromMedia(
    mediaId: string,
    characterId: string,
    tx?: Transaction
  ): Promise<void> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      await client
        .delete(mediaCharacters)
        .where(
          and(
            eq(mediaCharacters.mediaId, mediaId),
            eq(mediaCharacters.characterId, characterId)
          )
        );
    } catch (error) {
      throw new UnexpectedError(
        `Failed to remove character ${characterId} from media ${mediaId}`,
        error
      );
    }
  }
  async addToMediaBulk(
    mediaId: string,
    charactersData: { id: string; confidence?: number }[],
    source = "manual",
    tx?: Transaction
  ): Promise<void> {
    const client = (tx as unknown as TransactionClient) || db;
    if (charactersData.length === 0) {
      return;
    }

    let sourceUpdateSql = sql`excluded.source`;
    let confidenceUpdateSql = sql`excluded.confidence`;

    if (source === "AI") {
      sourceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.source ELSE media_characters.source END`;
      confidenceUpdateSql = sql`CASE WHEN media_characters.source = 'AI' THEN excluded.confidence ELSE media_characters.confidence END`;
    }

    try {
      await client
        .insert(mediaCharacters)
        .values(
          charactersData.map((char) => ({
            mediaId,
            characterId: char.id,
            confidence: char.confidence ?? null,
            source,
          }))
        )
        .onConflictDoUpdate({
          target: [mediaCharacters.mediaId, mediaCharacters.characterId],
          set: {
            confidence: confidenceUpdateSql,
            source: sourceUpdateSql,
          },
        });
    } catch (error) {
      throw new UnexpectedError(
        `Failed to bulk add characters to media ${mediaId}`,
        error
      );
    }
  }
}
