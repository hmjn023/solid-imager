import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import {
  type MediaSource,
  mediaSources,
  medias,
  type NewMedia,
} from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

type ImportData = {
  mediaSource: MediaSource;
  medias: NewMedia[];
  // Add other tables as needed
};

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

export const upsertMediaSourceData = (
  _sourceId: string,
  importData: ImportData
) =>
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

export const cloneMediaData = (originalSourceId: string, newSourceId: string) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    return yield* _(
      Effect.tryPromise({
        try: () =>
          db.transaction(async (tx) => {
            const allMedia = await tx
              .select()
              .from(medias)
              .where(eq(medias.sourceId, originalSourceId));

            if (allMedia.length > 0) {
              const newMedias: NewMedia[] = allMedia.map((media) => {
                const { id: _id, sourceId: _sourceId, ...rest } = media;
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
              message: `Failed to clone media data from source ID: ${originalSourceId} to ${newSourceId}`,
              details: error,
            })
        )
      )
    );
  });
