import type { MediaSearchParams, MediaUpdateData } from "~/lib/types";

export function getMediaDetails(sourceId: string, mediaId: string) {
  return {
    sourceId,
    mediaId,
    tags: [],
    metadata: {},
    categories: [],
    ips: [],
    characters: [],
  };
}

export function updateMedia(
  _sourceId: string,
  _mediaId: string,
  data: MediaUpdateData
) {
  return { success: true, updatedFields: Object.keys(data) };
}

export function getMediaMetadata(sourceId: string, mediaId: string) {
  return { sourceId, mediaId, metadata: {} };
}

export function getMediaTags(sourceId: string, mediaId: string) {
  return { sourceId, mediaId, tags: [] };
}

export function getMediaThumbnail(sourceId: string, mediaId: string) {
  return { sourceId, mediaId, thumbnail: "base64_encoded_thumbnail_image" };
}

export function uploadMedia(
  _sourceId: string,
  _mediaId: string,
  path: string,
  _file: File
) {
  return { success: true, filePath: path };
}

export function searchMedia(
  _sourceId: string,
  _queryParams: MediaSearchParams
) {
  return { media: [], total: 0, page: 1, limit: 10 };
}

export function searchMediaInDirectory(
  _sourceId: string,
  _directories: string,
  _queryParams: MediaSearchParams
) {
  return { media: [], total: 0, page: 1, limit: 10 };
}
