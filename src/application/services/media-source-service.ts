import { Effect } from "@effect/io/Effect";
import type {
  MediaSourceInfo,
  MediaSourceTypeEnum,
} from "~/domain/sources/types";

export class FetchError {
  readonly _tag = "FetchError";
  readonly message: string;
  readonly status?: number;
  constructor(message: string, status?: number) {
    this.message = message;
    this.status = status;
  }
}

const API_BASE_URL = "http://localhost:3000/api";

export type CreateSourceData = {
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: { path: string };
};

export type UpdateSourceData = CreateSourceData;

export const MediaSourceService = {
  // すべてのソースを取得します。
  fetchSources(): Effect.Effect<MediaSourceInfo[], FetchError, never> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${API_BASE_URL}/sources`);
        if (!response.ok) {
          const errorBody = await response.json();
          throw new FetchError(
            errorBody.message || "Failed to fetch sources",
            response.status
          );
        }
        return response.json();
      },
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
    sourceData: CreateSourceData
  ): Effect.Effect<MediaSourceInfo, FetchError, never> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${API_BASE_URL}/sources`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sourceData),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new FetchError(
            errorBody.message || "Failed to create source",
            response.status
          );
        }
        return response.json();
      },
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
    sourceData: UpdateSourceData
  ): Effect.Effect<MediaSourceInfo, FetchError, never> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sourceData),
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new FetchError(
            errorBody.message || "Failed to update source",
            response.status
          );
        }
        return response.json();
      },
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
  ): Effect.Effect<MediaSourceInfo | undefined, FetchError, never> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`);
        if (!response.ok) {
          const errorBody = await response.json();
          throw new FetchError(
            errorBody.message || "Failed to fetch source by ID",
            response.status
          );
        }
        return response.json();
      },
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
  deleteSource(sourceId: string): Effect.Effect<void, FetchError, never> {
    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${API_BASE_URL}/sources/${sourceId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorBody = await response.json();
          throw new FetchError(
            errorBody.message || "Failed to delete source",
            response.status
          );
        }
        return;
      },
      catch: (error) => {
        if (error instanceof FetchError) {
          return error;
        }
        return new FetchError("An unknown error occurred during deleteSource");
      },
    });
  },
};
