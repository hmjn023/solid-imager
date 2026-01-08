import type { Transaction } from "~/domain/interfaces/transaction-manager";
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
  findById(id: string, tx?: Transaction): Promise<MediaSource | null>;
  create(source: NewMediaSource, tx?: Transaction): Promise<MediaSource>;
  update(
    id: string,
    source: Partial<MediaSource>,
    tx?: Transaction
  ): Promise<MediaSource>;
  delete(id: string, tx?: Transaction): Promise<void>;
};
