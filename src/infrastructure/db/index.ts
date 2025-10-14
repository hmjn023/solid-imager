import { and, count, desc, eq, inArray, like, or, sql, sum } from "drizzle-orm";
import { Pool } from "pg";
import {
  type Media,
  type MediaSource,
  mediaDetails,
  mediaSources,
  medias,
  mediaTags,
  mediaTechnicalInfo,
  type NewMedia,
  type NewMediaSource,
  type NewMediaTag,
  similarMedia,
  type Tag,
  tags,
  thumbnailJobs,
} from "~/infrastructure/db/schema";

const dbHost = process.env.DB_HOST;
if (!dbHost) {
  throw new Error("DB_HOST is not defined in environment variables.");
}

const dbPort = process.env.DB_PORT;
if (!dbPort) {
  throw new Error("DB_PORT is not defined in environment variables.");
}

const dbUser = process.env.DB_USER;
if (!dbUser) {
  throw new Error("DB_USER is not defined in environment variables.");
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error("DB_PASSWORD is not defined in environment variables.");
}

const dbDatabase = process.env.DB_DATABASE;
if (!dbDatabase) {
  throw new Error("DB_DATABASE is not defined in environment variables.");
}

export const pool = new Pool({
  host: dbHost,
  port: Number.parseInt(dbPort, 10),
  user: dbUser,
  password: dbPassword,
  database: dbDatabase,
});

import { createDatabaseServiceLayer, DatabaseService } from "./layer";

export const DatabaseLive = createDatabaseServiceLayer(pool);

export const selectMediaSources = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(mediaSources)));
  });

export const selectMediaSourceById = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(mediaSources).where(eq(mediaSources.id, mediaSourceId))
      )
    );
  });

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.insert(mediaSources).values(mediaSource).returning()
      )
    );
  });

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(mediaSources)
          .set(mediaSource)
          .where(eq(mediaSources.id, mediaSourceId))
          .returning()
      )
    );
  });

export const deleteMediaSource = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(mediaSources)
          .where(eq(mediaSources.id, mediaSourceId))
          .returning()
      )
    );
  });

export const selectMediaBySourceId = (_sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(medias).where(eq(medias.sourceId, mediaSourceId))
      )
    );
  });

export const selectMediaById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(medias).where(eq(medias.id, mediaId))
      )
    );
  });

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(medias)
          .where(
            and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath))
          )
      )
    );
  });

export const insertMedia = (media: NewMedia) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.insert(medias).values(media).returning())
    );
  });

export const updateMedia = (mediaId: string, media: Media) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.update(medias).set(media).where(eq(medias.id, mediaId)).returning()
      )
    );
  });

export const deleteMedia = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.delete(medias).where(eq(medias.id, mediaId)))
    );
  });

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              like(medias.filePath, `${directoryPath}%`)
            )
          )
      )
    );
  });

// ========================================
// Feature 2: Thumbnail Functions
// ========================================



// ========================================
// Feature 3: Media Metadata Functions
// ========================================

export const selectMediaGenerationInfoById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(mediaGenerationInfo)
          .where(eq(mediaGenerationInfo.mediaId, mediaId))
      )
    );
  });

export const updateMediaGenerationInfo = (mediaId: string, metadata: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(mediaGenerationInfo)
          .set({ metadata: metadata as any })
          .where(eq(mediaGenerationInfo.mediaId, mediaId))
          .returning()
      )
    );
  });

// ========================================
// Feature 4: SSE Functions
// ========================================

// TODO: Implement if thumbnail job status table exists
export const selectThumbnailJobStatus = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(thumbnailJobs)
          .where(eq(thumbnailJobs.sourceId, sourceId))
      )
    );
  });

// ========================================
// Feature 7: Search Functions
// ========================================

export const searchMedia = (
  sourceId: string,
  searchOptions: { query?: string; tags?: string[] }
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(async () => {
        let query = db
          .select()
          .from(medias)
          .where(eq(medias.sourceId, sourceId));

        if (searchOptions.query) {
          query = query.where(
            or(
              like(medias.fileName, `%${searchOptions.query}%`),
              like(medias.description, `%${searchOptions.query}%`)
            )
          );
        }

        if (searchOptions.tags && searchOptions.tags.length > 0) {
          query = query.where(
            inArray(
              medias.id,
              db
                .select({ mediaId: mediaTags.mediaId })
                .from(mediaTags)
                .innerJoin(tags, eq(mediaTags.tagId, tags.id))
                .where(inArray(tags.name, searchOptions.tags))
            )
          );
        }

        return await query;
      })
    );
  });

export const searchMediaInDirectory = (
  sourceId: string,
  directoryPath: string,
  searchOptions: { query?: string; tags?: string[] }
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(async () => {
        let query = db
          .select()
          .from(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              like(medias.filePath, `${directoryPath}%`)
            )
          );

        if (searchOptions.query) {
          query = query.where(
            or(
              like(medias.fileName, `%${searchOptions.query}%`),
              like(medias.description, `%${searchOptions.query}%`)
            )
          );
        }

        if (searchOptions.tags && searchOptions.tags.length > 0) {
          query = query.where(
            inArray(
              medias.id,
              db
                .select({ mediaId: mediaTags.mediaId })
                .from(mediaTags)
                .innerJoin(tags, eq(mediaTags.tagId, tags.id))
                .where(inArray(tags.name, searchOptions.tags))
            )
          );
        }

        return await query;
      })
    );
  });

export const globalSearchMedia = (searchOptions: {
  query?: string;
  tags?: string[];
}) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(async () => {
        let query = db.select().from(medias);

        if (searchOptions.query) {
          query = query.where(
            or(
              like(medias.fileName, `%${searchOptions.query}%`),
              like(medias.description, `%${searchOptions.query}%`)
            )
          );
        }

        if (searchOptions.tags && searchOptions.tags.length > 0) {
          query = query.where(
            inArray(
              medias.id,
              db
                .select({ mediaId: mediaTags.mediaId })
                .from(mediaTags)
                .innerJoin(tags, eq(mediaTags.tagId, tags.id))
                .where(inArray(tags.name, searchOptions.tags))
            )
          );
        }

        return await query;
      })
    );
  });

// ========================================
// Feature 9: Directory Functions
// ========================================

export const deleteMediaByPath = (sourceId: string, directoryPath: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              like(medias.filePath, `${directoryPath}%`)
            )
          )
          .returning()
      )
    );
  });

// ========================================
// Feature 10: Category Functions
// ========================================

export const selectCategories = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(categories)));
  });

export const insertCategory = (categoryData: NewCategory) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.insert(categories).values(categoryData).returning()
      )
    );
  });

export const selectCategoryById = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(categories).where(eq(categories.id, categoryId))
      )
    );
  });

export const updateCategory = (categoryId: number, categoryData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(categories)
          .set(categoryData)
          .where(eq(categories.id, categoryId))
          .returning()
      )
    );
  });

export const deleteCategory = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.delete(categories).where(eq(categories.id, categoryId)).returning()
      )
    );
  });

// ========================================
// Feature 11: Character Functions
// ========================================

export const selectCharacters = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(characters)));
  });

export const insertCharacter = (characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.insert(characters).values(characterData).returning()
      )
    );
  });

export const selectCharacterById = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(characters).where(eq(characters.id, characterId))
      )
    );
  });

export const updateCharacter = (characterId: number, characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(characters)
          .set(characterData)
          .where(eq(characters.id, characterId))
          .returning()
      )
    );
  });

export const deleteCharacter = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.delete(characters).where(eq(characters.id, characterId)).returning()
      )
    );
  });

// ========================================
// Feature 12: IP Functions
// ========================================

export const selectIps = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(ips)));
  });

export const insertIp = (ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.insert(ips).values(ipData).returning())
    );
  });

export const selectIpById = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.select().from(ips).where(eq(ips.id, ipId)))
    );
  });

export const updateIp = (ipId: number, ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.update(ips).set(ipData).where(eq(ips.id, ipId)).returning()
      )
    );
  });

export const deleteIp = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.delete(ips).where(eq(ips.id, ipId)).returning())
    );
  });

// ========================================
// Feature 13: User Functions
// ========================================

export const selectUsers = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(users)));
  });

export const insertUser = (userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.insert(users).values(userData).returning())
    );
  });

export const selectUserById = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() => db.select().from(users).where(eq(users.id, userId)))
    );
  });

export const updateUser = (userId: string, userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.update(users).set(userData).where(eq(users.id, userId)).returning()
      )
    );
  });

export const deleteUser = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.delete(users).where(eq(users.id, userId)).returning()
      )
    );
  });

// ========================================
// Feature 14: Collection Functions
// ========================================

export const selectCollections = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(Effect.promise(() => db.select().from(collections)));
  });

export const insertCollection = (collectionData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.insert(collections).values(collectionData).returning()
      )
    );
  });

export const selectCollectionById = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.select().from(collections).where(eq(collections.id, collectionId))
      )
    );
  });

export const updateCollection = (
  collectionId: string,
  collectionData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(collections)
          .set(collectionData)
          .where(eq(collections.id, collectionId))
          .returning()
      )
    );
  });

export const deleteCollection = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(collections)
          .where(eq(collections.id, collectionId))
          .returning()
      )
    );
  });

export const insertCollectionMedia = (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .insert(collectionMedia)
          .values({ collectionId, mediaId, displayOrder })
          .returning()
      )
    );
  });

export const deleteCollectionMedia = (collectionId: string, mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(collectionMedia)
          .where(
            and(
              eq(collectionMedia.collectionId, collectionId),
              eq(collectionMedia.mediaId, mediaId)
            )
          )
          .returning()
      )
    );
  });

// ========================================
// Feature 15: Bulk Operation Functions
// ========================================

export const bulkUpdateMedia = (
  sourceId: string,
  mediaIds: string[],
  updates: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .update(medias)
          .set(updates as any)
          .where(
            and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
          )
          .returning()
      )
    );
  });

export const bulkDeleteMedia = (sourceId: string, mediaIds: string[]) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db
          .delete(medias)
          .where(
            and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
          )
          .returning()
      )
    );
  });

export const bulkUpdateMediaPaths = (
  sourceId: string,
  mediaIds: string[],
  pathUpdates: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.promise(() =>
        db.transaction(async (tx) => {
          const mediaToUpdate = await tx
            .select({ id: medias.id, fileName: medias.fileName })
            .from(medias)
            .where(
              and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
            );

          const updates = mediaToUpdate.map((media) => {
            const newFilePath = `${pathUpdates}/${media.fileName}`;
            return tx
              .update(medias)
              .set({ filePath: newFilePath })
              .where(eq(medias.id, media.id));
          });

          return Promise.all(updates);
        })
      )
    );
  });

export const bulkAddMediaTags = (
  _sourceId: string,
  mediaIds: string[],
  tagsToAdd: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const values: NewMediaTag[] = [];
    for (const mediaId of mediaIds) {
      for (const tagId of tagsToAdd) {
        values.push({ mediaId, tagId });
      }
    }

    if (values.length === 0) {
      return yield* _(Effect.succeed([]));
    }

    return yield* _(
      Effect.promise(() => db.insert(mediaTags).values(values).returning())
    );
  });

export const bulkRemoveMediaTags = (
  _sourceId: string,
  mediaIds: string[],
  tagsToRemove: number[]
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    if (mediaIds.length === 0 || tagsToRemove.length === 0) {
      return yield* _(Effect.succeed([]));
    }

    return yield* _(
      Effect.promise(() =>
        db
          .delete(mediaTags)
          .where(
            and(
              inArray(mediaTags.mediaId, mediaIds),
              inArray(mediaTags.tagId, tagsToRemove)
            )
          )
          .returning()
      )
    );
  });

// ========================================
// Feature 19: Workflow Functions
// ========================================

export const insertMediaTags = (mediaId: string, tagsToInsert: string[]) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db.transaction(async (tx) => {
          const existingTags = await tx
            .select()
            .from(tags)
            .where(inArray(tags.name, tagsToInsert));
          const existingTagNames = existingTags.map((t) => t.name);
          const newTagNames = tagsToInsert.filter(
            (t) => !existingTagNames.includes(t)
          );

          let newTags: Tag[] = [];
          if (newTagNames.length > 0) {
            newTags = await tx
              .insert(tags)
              .values(newTagNames.map((name) => ({ name })))
              .returning();
          }

          const allTags = [...existingTags, ...newTags];
          const mediaTagsToInsert = allTags.map((t) => ({
            mediaId,
            tagId: t.id,
          }));

          if (mediaTagsToInsert.length > 0) {
            await tx
              .insert(mediaTags)
              .values(mediaTagsToInsert)
              .onConflictDoNothing();
          }
        })
      )
    );
  });

// ========================================
// Feature 16: Data Migration Functions
// ========================================

export const selectMediaSourceData = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    const mediaSource = yield* _(
      Effect.promise(() =>
        db.query.mediaSources.findFirst({
          where: eq(mediaSources.id, sourceId),
          with: {
            media: {
              with: {
                tags: { with: { tag: true } },
                details: true,
                generationInfo: true,
                organization: {
                  with: { category: true, project: true, ip: true },
                },
                technicalInfo: true,
                sync: true,
                characters: { with: { character: true } },
              },
            },
          },
        })
      )
    );

    return mediaSource;
  });

export const upsertMediaSourceData = (_sourceId: string, importData: any) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db.transaction(async (tx) => {
          // Upsert mediaSource
          await tx
            .insert(mediaSources)
            .values(importData.mediaSource)
            .onConflictDoUpdate({
              target: mediaSources.id,
              set: importData.mediaSource,
            });

          // Upsert medias
          if (importData.medias && importData.medias.length > 0) {
            await tx
              .insert(medias)
              .values(importData.medias)
              .onConflictDoNothing();
            // Note: This is a simplification. A real implementation would need to handle updates.
          }

          // ... other tables would be handled here
        })
      )
    );
  });

export const reconcileMediaSource = (
  sourceId: string,
  fileSystemChanges: { added: NewMedia[]; deleted: string[] }
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db.transaction(async (tx) => {
          // Handle added files
          if (fileSystemChanges.added && fileSystemChanges.added.length > 0) {
            await tx
              .insert(medias)
              .values(fileSystemChanges.added)
              .onConflictDoNothing();
          }

          // Handle deleted files
          if (
            fileSystemChanges.deleted &&
            fileSystemChanges.deleted.length > 0
          ) {
            await tx
              .delete(medias)
              .where(
                and(
                  eq(medias.sourceId, sourceId),
                  inArray(medias.filePath, fileSystemChanges.deleted)
                )
              );
          }
        })
      )
    );
  });

export const cloneMediaData = (sourceId: string, newSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db.transaction(async (tx) => {
          const allMedia = await tx
            .select()
            .from(medias)
            .where(eq(medias.sourceId, sourceId));

          if (allMedia.length > 0) {
            const newMedias: NewMedia[] = allMedia.map((media) => {
              const { id, sourceId, ...rest } = media;
              return { ...rest, sourceId: newSourceId };
            });
            await tx.insert(medias).values(newMedias);
          }
        })
      )
    );
  });

// ========================================
// Feature 18: Analytics Functions
// ========================================

export const selectSourceStats = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db
          .select({
            mediaCount: count(medias.id),
            totalSize: sum(medias.fileSize),
          })
          .from(medias)
          .where(eq(medias.sourceId, sourceId))
      )
    );
  });

export const selectGlobalStats = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db
          .select({
            mediaCount: count(medias.id),
            totalSize: sum(medias.fileSize),
          })
          .from(medias)
      )
    );
  });

export const findDuplicateMedia = (_sourceId: string) =>
  Effect.gen(
function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db
          .select({
            hash: mediaTechnicalInfo.hashMd5,
            count: sql<number>`count(${mediaTechnicalInfo.id})`,
          })
          .from(mediaTechnicalInfo)
          .innerJoin(medias, eq(medias.id, mediaTechnicalInfo.mediaId))
          .where(eq(medias.sourceId, sourceId))
          .groupBy(mediaTechnicalInfo.hashMd5)
          .having(sql`count(${mediaTechnicalInfo.id}) > 1`)
      )
    );
  }
)

export const findSimilarMedia = (sourceId: string, mediaPath: string) =>
  Effect.gen(
function* (_) {
    const { db } = yield* _(DatabaseService);

    const media = yield* _(
      Effect.promise(() =>
        db
          .select({ id: medias.id })
          .from(medias)
          .where(
            and(
              eq(medias.sourceId, sourceId),
              eq(medias.filePath, mediaPath)
            )
          )
      )
    );

    if (media.length === 0) {
      return yield* _(Effect.fail(new Error("Media not found")));
    }

    const mediaId = media[0].id;

    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(similarMedia)
          .where(
            or(
              eq(similarMedia.media1Id, mediaId),
              eq(similarMedia.media2Id, mediaId)
            )
          )
      )
    );
  }
)

export const selectPopularMedia = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(mediaDetails)
          .orderBy(desc(mediaDetails.viewCount))
          .limit(10)
      )
    );
  });

// ========================================
// Feature 19: Workflow Functions
// ========================================



// ========================================
// Feature 20: Filter/Preset Functions
// ========================================

export const selectRecentMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.promise(() =>
        db
          .select()
          .from(medias)
          .where(eq(medias.sourceId, sourceId))
          .orderBy(desc(medias.createdAt))
          .limit(10)
      )
    );
  });
