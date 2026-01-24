import { eq, type InferSelectModel, inArray, sql } from "drizzle-orm";
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
import { db, type TransactionClient } from "~/infrastructure/db/index";
import { mediaTags, tags } from "~/infrastructure/db/schema";

type DbTag = InferSelectModel<typeof tags>;

function mapToDomain(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    description: dbTag.description,
    attribute: dbTag.attribute,
    color: dbTag.color,
    source: dbTag.source,
    authorId: dbTag.authorId,
    createdAt: dbTag.createdAt,
    updatedAt: dbTag.updatedAt,
  };
}

// Result type from join query
type MediaTagResult = {
  id: string;
  name: string;
  description: string | null;
  attribute: string | null;
  color: string | null;
  source: string;
  authorId: string | null;
  createdAt: Date;
  updatedAt: Date;
  type: "positive" | "negative";
};

function mapToMediaTag(row: MediaTagResult): MediaTag {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    attribute: row.attribute,
    color: row.color,
    source: row.source,
    authorId: row.authorId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    type: row.type,
  };
}

export class DrizzleTagRepository implements TagRepositoryDef {
  async findAll(): Promise<Tag[]> {
    try {
      const results = await db.select().from(tags);
      return results.map(mapToDomain);
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
      return mapToDomain(result[0]);
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
      return mapToDomain(result[0]);
    } catch (error) {
      throw new UnexpectedError(`Failed to select tag by name: ${name}`, error);
    }
  }

  async create(tag: NewTag, tx?: Transaction): Promise<Tag> {
    try {
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client.insert(tags).values(tag).returning();
      return mapToDomain(result[0]);
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
      const client = (tx as unknown as TransactionClient) || db;
      const result = await client
        .update(tags)
        .set(tag)
        .where(eq(tags.id, id))
        .returning();

      if (result.length === 0) {
        throw new ResourceNotFoundError("Tag", id);
      }
      return mapToDomain(result[0]);
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
      const client = (tx as unknown as TransactionClient) || db;
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
      const client = (tx as unknown as TransactionClient) || db;
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

      return result.map(mapToMediaTag);
    } catch (error) {
      throw new UnexpectedError(
        `Failed to retrieve tags for media ID: ${mediaId}`,
        error
      );
    }
  }

  async addTagsToMedia(
    mediaId: string,
    tagsToInsert: {
      name: string;
      type: "positive" | "negative";
      confidence?: number;
    }[],
    source = "manual",
    tx?: Transaction
  ): Promise<void> {
    try {
      // const _client = (tx as unknown as TransactionClient) || db;
      const execute = async (t: Transaction) => {
        const tagNames = tagsToInsert.map((tag) => tag.name);
        if (tagNames.length === 0) {
          return;
        }

        const client = t as unknown as TransactionClient;
        const existingTags = await client
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
          newTagsCreated = await (t as unknown as TransactionClient)
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
            confidence: tagToInsert.confidence ?? null,
            source,
          };
        });

        if (mediaTagsToInsert.length > 0) {
          await (t as unknown as TransactionClient)
            .insert(mediaTags)
            .values(mediaTagsToInsert)
            .onConflictDoUpdate({
              target: [mediaTags.mediaId, mediaTags.tagId, mediaTags.tagType],
              set: {
                confidence: sql`excluded.confidence`,
              },
            });
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
