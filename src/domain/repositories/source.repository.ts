import type { MediaSourceInfo } from "~/domain/sources/schemas";

// Using MediaSourceInfo as the base, but ensuring it matches the DB entity structure
// which is required for existing infrastructure utilities like getDriver.
export type MediaSource = MediaSourceInfo & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};
export type NewMediaSource = Omit<MediaSourceInfo, "id">;

export type SourceRepository = {
  findAll(): Promise<MediaSource[]>;
  findById(id: string): Promise<MediaSource | null>;
  create(source: NewMediaSource): Promise<MediaSource>;
  update(id: string, source: Partial<MediaSource>): Promise<MediaSource>;
  delete(id: string): Promise<void>;
};
