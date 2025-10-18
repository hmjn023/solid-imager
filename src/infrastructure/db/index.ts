import { and, count, desc, eq, inArray, like, or, sql, sum } from "drizzle-orm";
import { Effect } from "effect";
import { Pool } from "pg";
import {
  jobs,
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
  presets,
  similarMedia,
  type Tag,
  tags,
} from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";

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
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(mediaSources),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select media sources",
              details: error,
            })
        )
      )
    );
  });

export const selectMediaSourceById = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(mediaSources)
            .where(eq(mediaSources.id, mediaSourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media source by ID: ${mediaSourceId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(mediaSources).values(mediaSource).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media source with this name or ID already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert media source",
            details: error,
          });
        })
      )
    );
  });

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(mediaSources)
            .set(mediaSource)
            .where(eq(mediaSources.id, mediaSourceId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media source with this name or ID already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to update media source",
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteMediaSource = (mediaSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(mediaSources)
            .where(eq(mediaSources.id, mediaSourceId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media source with ID: ${mediaSourceId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source with ID ${mediaSourceId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const selectMediaById = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(medias).where(eq(medias.id, mediaId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const selectMediaBySourceIdAndFilePath = (
  sourceId: string,
  filePath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(
              and(eq(medias.sourceId, sourceId), eq(medias.filePath, filePath))
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID ${sourceId} and file path ${filePath}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media with source ID ${sourceId} and file path ${filePath} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertMedia = (media: NewMedia) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(medias).values(media).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media with this source ID and file path already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert media",
            details: error,
          });
        })
      )
    );
  });

export const updateMedia = (mediaId: string, media: Media) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(medias)
            .set(media)
            .where(eq(medias.id, mediaId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media with this source ID and file path already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to update media",
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteMedia = (mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(medias).where(eq(medias.id, mediaId)).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media with ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `Media with ID ${mediaId} not found` })
        )
      );
    }
    return result[0];
  });

export const selectMediaBySourceIdAndDirectoryPath = (
  sourceId: string,
  directoryPath: string
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(
              and(
                eq(medias.sourceId, sourceId),
                like(medias.filePath, `${directoryPath}%`)
              )
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID ${sourceId} and directory path ${directoryPath}`,
              details: error,
            })
        )
      )
    );
  });

export const selectMediaBySourceId = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(medias).where(eq(medias.sourceId, sourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media by source ID: ${sourceId}`,
              details: error,
            })
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
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(mediaGenerationInfo)
            .where(eq(mediaGenerationInfo.mediaId, mediaId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media generation info by media ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media generation info for media ID ${mediaId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateMediaGenerationInfo = (mediaId: string, metadata: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(mediaGenerationInfo)
            .set({ metadata: metadata as any })
            .where(eq(mediaGenerationInfo.mediaId, mediaId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to update media generation info for media ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media generation info for media ID ${mediaId} not found`,
          })
        )
      );
    }
    return result[0];
  });

// ========================================
// Feature 4: SSE Functions
// ========================================

// TODO: Implement if thumbnail job status table exists
export const selectJobsBySourceId = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(jobs).where(eq(jobs.sourceId, sourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select jobs for source ID: ${sourceId}`,
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: async () => {
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
        },
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to search media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
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
      Effect.tryPromise({
        try: async () => {
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
        },
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to search media in directory ${directoryPath} for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const globalSearchMedia = (searchOptions: {
  query?: string;
  tags?: string[];
}) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: async () => {
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
        },
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to perform global media search",
              details: error,
            })
        )
      )
    );
  });

// ========================================
// Feature 9: Directory Functions
// ========================================

export const deleteMediaByPath = (sourceId: string, directoryPath: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(medias)
            .where(
              and(
                eq(medias.sourceId, sourceId),
                like(medias.filePath, `${directoryPath}%`)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media by path ${directoryPath} for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

// ========================================
// Feature 10: Category Functions
// ========================================

export const selectCategories = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(categories),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select categories",
              details: error,
            })
        )
      )
    );
  });

export const insertCategory = (categoryData: NewCategory) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(categories).values(categoryData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Category with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert category",
            details: error,
          });
        })
      )
    );
  });

export const selectCategoryById = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(categories).where(eq(categories.id, categoryId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select category by ID: ${categoryId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCategory = (categoryId: number, categoryData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(categories)
            .set(categoryData)
            .where(eq(categories.id, categoryId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Category with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update category with ID: ${categoryId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCategory = (categoryId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(categories)
            .where(eq(categories.id, categoryId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete category with ID: ${categoryId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Category with ID ${categoryId} not found`,
          })
        )
      );
    }
    return result[0];
  });

// ========================================
// Feature 11: Character Functions
// ========================================

export const selectCharacters = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(characters),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select characters",
              details: error,
            })
        )
      )
    );
  });

export const insertCharacter = (characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(characters).values(characterData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Character with this name and IP already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert character",
            details: error,
          });
        })
      )
    );
  });

export const selectCharacterById = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(characters).where(eq(characters.id, characterId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select character by ID: ${characterId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCharacter = (characterId: number, characterData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(characters)
            .set(characterData)
            .where(eq(characters.id, characterId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Character with this name and IP already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update character with ID: ${characterId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCharacter = (characterId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(characters)
            .where(eq(characters.id, characterId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete character with ID: ${characterId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Character with ID ${characterId} not found`,
          })
        )
      );
    }
    return result[0];
  });

// ========================================
// Feature 12: IP Functions
// ========================================

export const selectIps = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(ips),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select IPs",
              details: error,
            })
        )
      )
    );
  });

export const insertIp = (ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(ips).values(ipData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "IP with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert IP",
            details: error,
          });
        })
      )
    );
  });

export const selectIpById = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(ips).where(eq(ips.id, ipId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select IP by ID: ${ipId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }
    return result[0];
  });

export const updateIp = (ipId: number, ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.update(ips).set(ipData).where(eq(ips.id, ipId)).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "IP with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update IP with ID: ${ipId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteIp = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(ips).where(eq(ips.id, ipId)).returning(),

        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete IP with ID: ${ipId}`,

              details: error,
            })
        )
      )
    );

    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }

    return result[0];
  });

// ========================================
// Feature 13: User Functions
// ========================================

export const selectUsers = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(users),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select users",
              details: error,
            })
        )
      )
    );
  });

export const insertUser = (userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(users).values(userData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "User with this email already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert user",
            details: error,
          });
        })
      )
    );
  });

export const selectUserById = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(users).where(eq(users.id, userId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select user by ID: ${userId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });

export const updateUser = (userId: string, userData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(users)
            .set(userData)
            .where(eq(users.id, userId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "User with this email already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update user with ID: ${userId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteUser = (userId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(users).where(eq(users.id, userId)).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete user with ID: ${userId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `User with ID ${userId} not found` })
        )
      );
    }
    return result[0];
  });

// ========================================
// Feature 14: Collection Functions
// ========================================

export const selectCollections = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(collections),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select collections",
              details: error,
            })
        )
      )
    );
  });

export const insertCollection = (collectionData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(collections).values(collectionData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Collection with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert collection",
            details: error,
          });
        })
      )
    );
  });

export const selectCollectionById = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.select().from(collections).where(eq(collections.id, collectionId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select collection by ID: ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const updateCollection = (
  collectionId: string,
  collectionData: unknown
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .update(collections)
            .set(collectionData)
            .where(eq(collections.id, collectionId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Collection with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update collection with ID: ${collectionId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const deleteCollection = (collectionId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(collections)
            .where(eq(collections.id, collectionId))
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete collection with ID: ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Collection with ID ${collectionId} not found`,
          })
        )
      );
    }
    return result[0];
  });

export const insertCollectionMedia = (
  collectionId: string,
  mediaId: string,
  displayOrder?: number
) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .insert(collectionMedia)
            .values({ collectionId, mediaId, displayOrder })
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Media already exists in this collection",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to insert media ${mediaId} into collection ${collectionId}`,
            details: error,
          });
        })
      )
    );
  });

export const deleteCollectionMedia = (collectionId: string, mediaId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(collectionMedia)
            .where(
              and(
                eq(collectionMedia.collectionId, collectionId),
                eq(collectionMedia.mediaId, mediaId)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete media ${mediaId} from collection ${collectionId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media ${mediaId} not found in collection ${collectionId}`,
          })
        )
      );
    }
    return result[0];
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
      Effect.tryPromise({
        try: () =>
          db
            .update(medias)
            .set(updates as any)
            .where(
              and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk update media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const bulkDeleteMedia = (sourceId: string, mediaIds: string[]) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .delete(medias)
            .where(
              and(eq(medias.sourceId, sourceId), inArray(medias.id, mediaIds))
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk delete media for source ID: ${sourceId}`,
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to bulk update media paths for source ID: ${sourceId}`,
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: () => db.insert(mediaTags).values(values).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "One or more media tags already exist",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to bulk add media tags",
            details: error,
          });
        })
      )
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
      Effect.tryPromise({
        try: () =>
          db
            .delete(mediaTags)
            .where(
              and(
                inArray(mediaTags.mediaId, mediaIds),
                inArray(mediaTags.tagId, tagsToRemove)
              )
            )
            .returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to bulk remove media tags",
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "One or more media tags already exist",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to insert media tags for media ID: ${mediaId}`,
            details: error,
          });
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
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select media source data for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );

    if (!mediaSource) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media source data for ID ${sourceId} not found`,
          })
        )
      );
    }

    return mediaSource;
  });

export const upsertMediaSourceData = (_sourceId: string, importData: any) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to upsert media source data for source ID: ${_sourceId}`,
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to reconcile media source for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const cloneMediaData = (sourceId: string, newSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
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
          }),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to clone media data from source ID: ${sourceId} to ${newSourceId}`,
              details: error,
            })
        )
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
      Effect.tryPromise({
        try: () =>
          db
            .select({
              mediaCount: count(medias.id),
              totalSize: sum(medias.fileSize),
            })
            .from(medias)
            .where(eq(medias.sourceId, sourceId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select source statistics for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const selectGlobalStats = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select({
              mediaCount: count(medias.id),
              totalSize: sum(medias.fileSize),
            })
            .from(medias),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select global statistics",
              details: error,
            })
        )
      )
    );
  });

export const findDuplicateMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select({
              hash: mediaTechnicalInfo.hashMd5,
              count: sql<number>`count(${mediaTechnicalInfo.id})`,
            })
            .from(mediaTechnicalInfo)
            .innerJoin(medias, eq(medias.id, mediaTechnicalInfo.mediaId))
            .where(eq(medias.sourceId, sourceId))
            .groupBy(mediaTechnicalInfo.hashMd5)
            .having(sql`count(${mediaTechnicalInfo.id}) > 1`),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to find duplicate media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const findSimilarMedia = (sourceId: string, mediaPath: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    const media = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select({ id: medias.id })
            .from(medias)
            .where(
              and(eq(medias.sourceId, sourceId), eq(medias.filePath, mediaPath))
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to find media for source ID ${sourceId} and path ${mediaPath}`,
              details: error,
            })
        )
      )
    );

    if (media.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `Media with source ID ${sourceId} and path ${mediaPath} not found`,
          })
        )
      );
    }

    const mediaId = media[0].id;

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(similarMedia)
            .where(
              or(
                eq(similarMedia.media1Id, mediaId),
                eq(similarMedia.media2Id, mediaId)
              )
            ),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to find similar media for media ID: ${mediaId}`,
              details: error,
            })
        )
      )
    );
  });

export const selectPopularMedia = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(mediaDetails)
            .orderBy(desc(mediaDetails.viewCount))
            .limit(10),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select popular media",
              details: error,
            })
        )
      )
    );
  });

// ========================================
// Feature 19: Workflow Functions
// ========================================

// ========================================
// Feature 20: Filter/Preset Functions
// ========================================

export const selectRandomMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(eq(medias.sourceId, sourceId))
            .orderBy(sql`RANDOM()`)
            .limit(1),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select random media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({
            message: `No random media found for source ID ${sourceId}`,
          })
        )
      );
    }
    return result[0];
  });

export const selectRecentMedia = (sourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(medias)
            .where(eq(medias.sourceId, sourceId))
            .orderBy(desc(medias.createdAt))
            .limit(10),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select recent media for source ID: ${sourceId}`,
              details: error,
            })
        )
      )
    );
  });

export const selectJobs = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(jobs),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select jobs",
              details: error,
            })
        )
      )
    );
  });

export const updateJobStatus = (jobId: string, status: "pending" | "in_progress" | "completed" | "failed") =>

  Effect.gen(function* (_) {

    const { db } = yield* _(DatabaseService);

    const result = yield* _(

      Effect.tryPromise({

        try: () =>

          db

            .update(jobs)

            .set({ status })

            .where(eq(jobs.id, jobId))

            .returning(),

        catch: (error) => error,

      }).pipe(

        Effect.mapError(

          (error) =>

            new UnknownDbError({

              message: `Failed to update job status for job ID: ${jobId}`,

              details: error,

            })

        )

      )

    );

    if (result.length === 0) {

      return yield* _(

        Effect.fail(

          new NotFoundError({

            message: `Job with ID ${jobId} not found`,

          })

        )

      );

    }

    return result[0];

  });

export const selectMediaForAutoTagging = (sourceId: string) =>

  Effect.gen(function* (_) {

    const { db } = yield* _(DatabaseService);

    return yield* _(

      Effect.tryPromise({

        try: () =>

          db

            .select()

            .from(medias)

            .where(eq(medias.sourceId, sourceId)),

        catch: (error) => error,

      }).pipe(

        Effect.mapError(

          (error) =>

            new UnknownDbError({

              message: `Failed to select media for auto-tagging for source ID: ${sourceId}`,

              details: error,

            })

        )

      )

    );

  });

export const selectPresets = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(presets),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select presets",
              details: error,
            })
        )
      )
    );
  });

export const insertPreset = (presetData: any) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(presets).values(presetData).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({
              message: "Preset with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert preset",
            details: error,
          });
        })
      )
    );
  });
