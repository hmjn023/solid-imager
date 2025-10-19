import { cache } from "@solidjs/router";
import type { MediaSourceTypeEnum } from "~/domain/sources/types";
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

// Server functions - これらはサーバー側でのみ実行されます
const fetchSourcesServer = cache(async (): Promise<MediaSource[]> => {
  "use server";
  const { selectMediaSources } = await import(
    "~/infrastructure/db/media-sources"
  );
  return selectMediaSources();
}, "fetchSources");

const createSourceServer = async (
  sourceData: NewMediaSource
): Promise<MediaSource[]> => {
  "use server";
  const { insertMediaSource } = await import(
    "~/infrastructure/db/media-sources"
  );
  return insertMediaSource(sourceData);
};

const updateSourceServer = async (
  sourceId: string,
  sourceData: MediaSource
): Promise<MediaSource[]> => {
  "use server";
  const { updateMediaSource } = await import(
    "~/infrastructure/db/media-sources"
  );
  return updateMediaSource(sourceId, sourceData);
};

const fetchSourceByIdServer = cache(
  async (sourceId: string): Promise<(MediaSource | undefined)[]> => {
    "use server";
    const { selectMediaSourceById } = await import(
      "~/infrastructure/db/media-sources"
    );
    return selectMediaSourceById(sourceId);
  },
  "fetchSourceById"
);

const deleteSourceServer = async (sourceId: string): Promise<MediaSource[]> => {
  "use server";
  const { deleteMediaSource } = await import(
    "~/infrastructure/db/media-sources"
  );
  return deleteMediaSource(sourceId);
};

export const MediaSourceService = {
  fetchSources: fetchSourcesServer,
  createSource: createSourceServer,
  updateSource: updateSourceServer,
  fetchSourceById: fetchSourceByIdServer,
  deleteSource: deleteSourceServer,
};
