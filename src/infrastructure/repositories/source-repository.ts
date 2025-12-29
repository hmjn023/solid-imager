import { eq } from "drizzle-orm";
import type {
  MediaSource,
  NewMediaSource,
  SourceRepository,
} from "~/domain/repositories/source.repository";
import {
  ConstraintError,
  NotFoundError,
  UnknownDbError,
} from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index";
import { mediaSources } from "~/infrastructure/db/schema";

export class DrizzleSourceRepository implements SourceRepository {
  async findAll(): Promise<MediaSource[]> {
    try {
      const results = await db.select().from(mediaSources);
      // Map Drizzle result to Domain Entity if necessary.
      // Currently they match in structure for MediaSourceInfo (mostly).
      // Drizzle schema has createdAt/updatedAt as Date, which matches MediaSourceInfo (if Zod inferred correctly).
      // We might need explicit casting or mapping if types diverge.
      return results as unknown as MediaSource[];
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to select media sources",
        details: error,
      });
    }
  }

  async findById(id: string): Promise<MediaSource | null> {
    try {
      const result = await db
        .select()
        .from(mediaSources)
        .where(eq(mediaSources.id, id));

      if (result.length === 0) {
        return null; // Return null as per repository contract
      }
      return result[0] as unknown as MediaSource;
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select media source by ID: ${id}`,
        details: error,
      });
    }
  }

  async create(source: NewMediaSource): Promise<MediaSource> {
    try {
      // Drizzle insert expects values matching the schema.
      // We cast to proper logic or use mapping if needed.
      // For now, assume compatibility but avoid 'any' if possible or use 'unknown' then specific type.
      // Drizzle's values() accepts InferInsertModel.
      const result = await db
        .insert(mediaSources)
        .values(source as typeof mediaSources.$inferInsert)
        .returning();
      return result[0] as unknown as MediaSource;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ConstraintError({
          message: "Media source with this name or ID already exists",
          details: error,
        });
      }
      throw new UnknownDbError({
        message: "Failed to insert media source",
        details: error,
      });
    }
  }

  async update(id: string, source: Partial<MediaSource>): Promise<MediaSource> {
    try {
      const result = await db
        .update(mediaSources)
        .set(source as typeof mediaSources.$inferInsert)
        .where(eq(mediaSources.id, id))
        .returning();

      if (result.length === 0) {
        // If update fails because it doesn't exist, we might want to throw NotFound or return null?
        // The interface definition for update usually implies existing entity.
        // Let's throw NotFound to match current behavior for update actions.
        throw new NotFoundError({
          message: `Media source with ID ${id} not found`,
        });
      }
      return result[0] as unknown as MediaSource;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ConstraintError({
          message: "Media source with this name or ID already exists",
          details: error,
        });
      }
      throw new UnknownDbError({
        message: `Failed to update media source with ID: ${id}`,
        details: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await db
        .delete(mediaSources)
        .where(eq(mediaSources.id, id))
        .returning();
      if (result.length === 0) {
        throw new NotFoundError({
          message: `Media source with ID ${id} not found`,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to delete media source with ID: ${id}`,
        details: error,
      });
    }
  }
}
