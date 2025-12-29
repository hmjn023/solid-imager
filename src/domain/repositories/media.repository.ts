import type {
  AddMediaRequest,
  Media,
  MediaSearchRequest,
  MediaSearchResponse,
  UpdateMediaRequest,
} from "~/domain/media/schemas";

export type MediaRepository = {
  findById(id: string): Promise<Media | null>;
  findByPath(sourceId: string, filePath: string): Promise<Media | null>;
  create(media: AddMediaRequest): Promise<Media>;
  update(id: string, media: UpdateMediaRequest): Promise<Media>;
  delete(id: string): Promise<void>;
  search(criteria: MediaSearchRequest): Promise<MediaSearchResponse>;
  count(): Promise<number>;
};
