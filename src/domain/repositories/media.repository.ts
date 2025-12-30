import type {
  AddMediaRequest,
  Author,
  Media,
  MediaGenerationInfo,
  MediaSearchRequest,
  MediaSearchResponse,
  MediaTag,
  MediaUrl,
  UpdateMediaRequest,
} from "~/domain/media/schemas";

// biome-ignore lint/style/useNamingConvention: Interface naming
export type IMediaRepository = {
  findById(id: string): Promise<Media | null>;
  findByPath(sourceId: string, filePath: string): Promise<Media | null>;
  create(media: AddMediaRequest): Promise<Media>;
  update(id: string, media: UpdateMediaRequest): Promise<Media>;
  delete(id: string): Promise<void>;
  search(
    sourceId: string,
    criteria: MediaSearchRequest
  ): Promise<MediaSearchResponse>;

  // Ancillary data
  getTags(mediaId: string): Promise<MediaTag[]>;
  getGenerationInfo(mediaId: string): Promise<MediaGenerationInfo | null>;
  getAuthors(mediaId: string): Promise<Author[]>;
  getUrls(mediaId: string): Promise<MediaUrl[]>;
  addUrls(mediaId: string, urls: string[]): Promise<MediaUrl[]>;
  upsertGenerationInfo(
    mediaId: string,
    prompt: string | null,
    workflow: unknown
  ): Promise<MediaGenerationInfo>;

  // Bulk/List
  findAllBySourceId(sourceId: string): Promise<Media[]>;
  searchInDirectory(
    sourceId: string,
    directoryPath: string,
    params: { query?: string; tags?: string[] }
  ): Promise<Media[]>;
};
