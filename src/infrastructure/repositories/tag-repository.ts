import { eq, inArray } from "drizzle-orm";
import {
  ResourceConflictError,
  ResourceNotFoundError,
  UnexpectedError,
} from "~/domain/errors";
import type { Transaction } from "~/domain/interfaces/transaction-manager";
import type { MediaTag } from "~/domain/media/schemas";
import type {
  NewTag,
  Tag,
  TagRepository as TagRepositoryDef,
} from "~/domain/repositories/tag-repository";
import type { UpdateTag } from "~/domain/tags/schemas";
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
      throw new UnexpectedError("Failed to select tags", error);
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
      throw new UnexpectedError(`Failed to select tag by ID: ${id}`, error);
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
      throw new UnexpectedError(`Failed to select tag by name: ${name}`, error);
    }
  }

  async create(tag: NewTag, tx?: Transaction): Promise<Tag> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client.insert(tags).values(tag).returning();
      return result[0] as unknown as Tag;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError(
          `Tag with name '${tag.name}' already exists`
        );
      }
      throw new UnexpectedError("Failed to insert tag", error);
    }
  }

  async update(id: string, tag: UpdateTag, tx?: Transaction): Promise<Tag> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .update(tags)
        .set(tag)
        .where(eq(tags.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Tag", id);
      }
      return result[0] as unknown as Tag;
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
          `Tag with name '${tag.name}' already exists`
        );
      }
      throw new UnexpectedError(`Failed to update tag with ID: ${id}`, error);
    }
  }

  async delete(id: string, tx?: Transaction): Promise<void> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
        .delete(tags)
        .where(eq(tags.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Tag", id);
      }
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw error;
      }
      throw new UnexpectedError(`Failed to delete tag with ID: ${id}`, error);
    }
  }

  async findByMediaId(mediaId: string, tx?: Transaction): Promise<MediaTag[]> {
    try {
      const client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const result = await client
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

      return result as unknown as MediaTag[];
    } catch (error) {
      throw new UnexpectedError(
        `Failed to retrieve tags for media ID: ${mediaId}`,
        error
      );
    }
  }

  async addTagsToMedia(
    mediaId: string,
    tagsToInsert: { name: string; type: "positive" | "negative" }[],
    source = "manual",
    tx?: Transaction
  ): Promise<void> {
    try {
      const _client =
        /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (tx as any) ||
        db;
      const execute = async (t: Transaction) => {
        const tagNames = tagsToInsert.map((tag) => tag.name);
        if (tagNames.length === 0) {
          return;
        }

        const existingTags =
          await /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (
            t as any
          )
            .select()
            .from(tags)
            .where(inArray(tags.name, tagNames));

        const existingTagNames = existingTags.map(
          /* biome-ignore lint/suspicious/noExplicitAny: DB result mapping */ (
            tag: any
          ) => tag.name
        );
        const newTagNames = tagNames.filter(
          (name) => !existingTagNames.includes(name)
        );

        let newTagsCreated: (typeof tags.$inferSelect)[] = [];
        if (newTagNames.length > 0) {
          newTagsCreated =
            await /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (
              t as any
            )
              .insert(tags)
              .values(newTagNames.map((name) => ({ name, source })))
              .returning();
        }

        const allTags = [...existingTags, ...newTagsCreated];
        const mediaTagsToInsert = tagsToInsert.map((tagToInsert) => {
          const foundTag = allTags.find((tag) => tag.name === tagToInsert.name);
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
          await /* biome-ignore lint/suspicious/noExplicitAny: Transaction cast */ (
            t as any
          )
            .insert(mediaTags)
            .values(mediaTagsToInsert)
            .onConflictDoNothing();
        }
      };

      if (tx) {
        await execute(tx);
      } else {
        await db.transaction(execute);
      }
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "23505"
      ) {
        throw new ResourceConflictError("One or more media tags already exist");
      }
      throw new UnexpectedError(
        `Failed to insert media tags for media ID: ${mediaId}`,
        error
      );
    }
  }
}

export const TagRepository = new DrizzleTagRepository();
