import type { MediaSourceInfo } from "~/domain/sources/schemas";

// Using MediaSourceInfo as the main entity for now as it maps closely,
// though we might want a stricter MediaSource entity later.
export type MediaSource = MediaSourceInfo;
export type NewMediaSource = Omit<MediaSourceInfo, "id">;

export type SourceRepository = {
  findAll(): Promise<MediaSource[]>;
  findById(id: string): Promise<MediaSource | null>;
  create(source: NewMediaSource): Promise<MediaSource>;
  update(id: string, source: Partial<MediaSource>): Promise<MediaSource>;
  delete(id: string): Promise<void>;
};
