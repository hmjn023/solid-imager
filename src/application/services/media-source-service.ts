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
  fetchSources(): Promise<MediaSource[]> {
    return selectMediaSources();
  },

  // 新しいソースを作成します。
  createSource(sourceData: NewMediaSource): Promise<MediaSource[]> {
    return insertMediaSource(sourceData);
  },

  // 既存のソースを更新します。
  updateSource(
    sourceId: string,
    sourceData: MediaSource
  ): Promise<MediaSource[]> {
    return updateMediaSourceDb(sourceId, sourceData);
  },

  // IDでソースを取得します。
  fetchSourceById(sourceId: string): Promise<(MediaSource | undefined)[]> {
    return selectMediaSourceById(sourceId);
  },

  // ソースを削除します。
  deleteSource(sourceId: string): Promise<MediaSource[]> {
    return deleteMediaSource(sourceId);
  },
};
