import type { NewTag, TagResponse, UpdateTag } from "~/domain/tags/schemas";

// Re-export types for usage in implementations
export type { NewTag, UpdateTag } from "~/domain/tags/schemas";

// TagResponse maps to the Tag entity in this context
export type Tag = TagResponse;

export type TagRepository = {
  findAll(): Promise<Tag[]>;
  findById(id: string): Promise<Tag | null>;
  findByName(name: string): Promise<Tag | null>;
  create(tag: NewTag): Promise<Tag>;
  update(id: string, tag: UpdateTag): Promise<Tag>;
  delete(id: string): Promise<void>;
};
