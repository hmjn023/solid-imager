import { Effect } from "effect";
import type { MediaSourceTypeEnum } from "~/domain/sources/types";
import {
  deleteMediaSource,
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource as updateMediaSourceDb,
} from "~/infrastructure/db/media-sources";
import type { MediaSource, NewMediaSource } from "~/infrastructure/db/schema";

export class FetchError {
  readonly _tag = "FetchError";
  readonly message: string;
  readonly status?: number;
  constructor(message: string, status?: number) {
    this.message = message;
    this.status = status;
  }
}

export type CreateSourceData = {
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: { path: string };
};

export type UpdateSourceData = CreateSourceData;

export const MediaSourceService = {
  // すべてのソースを取得します。
  fetchSources(): Effect.Effect<MediaSource[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => await selectMediaSources(),
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError("An unknown error occurred during fetchSources");
      },
    });
  },

  // 新しいソースを作成します。
  createSource(
    sourceData: NewMediaSource
  ): Effect.Effect<MediaSource[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => await insertMediaSource(sourceData),
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError("An unknown error occurred during createSource");
      },
    });
  },

  // 既存のソースを更新します。
  updateSource(
    sourceId: string,
    sourceData: MediaSource
  ): Effect.Effect<MediaSource[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => await updateMediaSourceDb(sourceId, sourceData),
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError("An unknown error occurred during updateSource");
      },
    });
  },

  // IDでソースを取得します。
  fetchSourceById(
    sourceId: string
  ): Effect.Effect<(MediaSource | undefined)[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => await selectMediaSourceById(sourceId),
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError(
          "An unknown error occurred during fetchSourceById"
        );
      },
    });
  },

  // ソースを削除します。
  deleteSource(
    sourceId: string
  ): Effect.Effect<MediaSource[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => await deleteMediaSource(sourceId),
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError("An unknown error occurred during deleteSource");
      },
    });
  },
};
