import { eq } from "drizzle-orm";
import type {
  NewTag,
  Tag,
  TagRepository,
} from "~/domain/repositories/tag.repository";
import type { UpdateTag } from "~/domain/tags/schemas";
import {
  ConstraintError,
  NotFoundError,
  UnknownDbError,
} from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index";
import { tags } from "~/infrastructure/db/schema";

export class DrizzleTagRepository implements TagRepository {
  async findAll(): Promise<Tag[]> {
    try {
      const results = await db.select().from(tags);
      // Drizzle result matches Tag (TagResponse) structure (roughly)
      // TagResponse has Date for createdAt/updatedAt, Drizzle returns Date.
      return results as unknown as Tag[];
    } catch (error) {
      throw new UnknownDbError({
        message: "Failed to select tags",
        details: error,
      });
    }
  }

  async findById(id: string): Promise<Tag | null> {
    try {
      const result = await db.select().from(tags).where(eq(tags.id, id));
      if (result.length === 0) {
        return null;
      }
      return result[0] as unknown as Tag;
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select tag by ID: ${id}`,
        details: error,
      });
    }
  }

  async findByName(name: string): Promise<Tag | null> {
    try {
      const result = await db.select().from(tags).where(eq(tags.name, name));
      if (result.length === 0) {
        return null;
      }
      return result[0] as unknown as Tag;
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to select tag by name: ${name}`,
        details: error,
      });
    }
  }

  async create(tag: NewTag): Promise<Tag> {
    try {
      const result = await db.insert(tags).values(tag).returning();
      return result[0] as unknown as Tag;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ConstraintError({
          message: `Tag with name '${tag.name}' already exists`,
          details: error,
        });
      }
      throw new UnknownDbError({
        message: "Failed to insert tag",
        details: error,
      });
    }
  }

  async update(id: string, tag: UpdateTag): Promise<Tag> {
    try {
      const result = await db
        .update(tags)
        .set(tag)
        .where(eq(tags.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundError({
          message: `Tag with ID ${id} not found`,
        });
      }
      return result[0] as unknown as Tag;
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
          message: `Tag with name '${tag.name}' already exists`,
          details: error,
        });
      }
      throw new UnknownDbError({
        message: `Failed to update tag with ID: ${id}`,
        details: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const result = await db.delete(tags).where(eq(tags.id, id)).returning();

      if (result.length === 0) {
        throw new NotFoundError({
          message: `Tag with ID ${id} not found`,
        });
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new UnknownDbError({
        message: `Failed to delete tag with ID: ${id}`,
        details: error,
      });
    }
  }
}
