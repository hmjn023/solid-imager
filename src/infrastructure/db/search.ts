import { and, eq, inArray, like, or } from "drizzle-orm";
import { Effect } from "effect";
import { medias, mediaTags, tags } from "~/infrastructure/db/schema";
import { UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

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
