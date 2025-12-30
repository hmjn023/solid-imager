import { eq, inArray } from "drizzle-orm";
import type {
  NewTag,
  Tag,
  TagRepository as TagRepositoryDef,
} from "~/domain/repositories/tag.repository";
import type { UpdateTag } from "~/domain/tags/schemas";
import {
  ConstraintError,
  NotFoundError,
  UnknownDbError,
} from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index";
import { mediaTags, tags } from "~/infrastructure/db/schema";

export class DrizzleTagRepository implements TagRepositoryDef {
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

  async findByMediaId(
    mediaId: string
  ): Promise<(Tag & { type: "positive" | "negative" })[]> {
    try {
      const result = await db
        .select({
          id: tags.id,
          name: tags.name,
          description: tags.description,
          attribute: tags.attribute,
          color: tags.color,
          source: tags.source,
          authorId: tags.authorId,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
          type: mediaTags.tagType,
        })
        .from(mediaTags)
        .innerJoin(tags, eq(mediaTags.tagId, tags.id))
        .where(eq(mediaTags.mediaId, mediaId));

      return result as unknown as (Tag & { type: "positive" | "negative" })[];
    } catch (error) {
      throw new UnknownDbError({
        message: `Failed to retrieve tags for media ID: ${mediaId}`,
        details: error,
      });
    }
  }

  async addTagsToMedia(
    mediaId: string,
    tagsToInsert: { name: string; type: "positive" | "negative" }[],
    source = "manual"
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        const tagNames = tagsToInsert.map((t) => t.name);
        if (tagNames.length === 0) {
          return;
        }

        const existingTags = await tx
          .select()
          .from(tags)
          .where(inArray(tags.name, tagNames));

        const existingTagNames = existingTags.map((t) => t.name);
        const newTagNames = tagNames.filter(
          (name) => !existingTagNames.includes(name)
        );

        let newTagsCreated: (typeof tags.$inferSelect)[] = [];
        if (newTagNames.length > 0) {
          newTagsCreated = await tx
            .insert(tags)
            .values(newTagNames.map((name) => ({ name, source })))
            .returning();
        }

        const allTags = [...existingTags, ...newTagsCreated];
        const mediaTagsToInsert = tagsToInsert.map((tagToInsert) => {
          const foundTag = allTags.find((t) => t.name === tagToInsert.name);
          if (!foundTag) {
            throw new Error(
              `Tag ${tagToInsert.name} not found after insertion`
            );
          }
          return {
            mediaId,
            tagId: foundTag.id,
            tagType: tagToInsert.type,
            source,
          };
        });

        if (mediaTagsToInsert.length > 0) {
          await tx
            .insert(mediaTags)
            .values(mediaTagsToInsert)
            .onConflictDoNothing();
        }
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ConstraintError({
          message: "One or more media tags already exist",
          details: error,
        });
      }
      throw new UnknownDbError({
        message: `Failed to insert media tags for media ID: ${mediaId}`,
        details: error,
      });
    }
  }
}

export const TagRepository = new DrizzleTagRepository();
