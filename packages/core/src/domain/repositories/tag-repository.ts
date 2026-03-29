import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type { MediaTag } from "@/domain/media/schemas";
import type { NewTag, TagResponse, UpdateTag } from "@/domain/tags/schemas";

// Re-export types for usage in implementations
export type { NewTag, UpdateTag } from "@/domain/tags/schemas";

// TagResponse maps to the Tag entity in this context
export type Tag = TagResponse;

export type TagRepository = {
	findAll(): Promise<Tag[]>;
	findById(id: string): Promise<Tag | null>;
	findByName(name: string): Promise<Tag | null>;
	create(tag: NewTag, tx?: Transaction): Promise<Tag>;
	update(id: string, tag: UpdateTag, tx?: Transaction): Promise<Tag>;
	delete(id: string, tx?: Transaction): Promise<void>;

	// Associations
	findByMediaId(mediaId: string, tx?: Transaction): Promise<MediaTag[]>;
	addTagsToMedia(
		mediaId: string,
		tags: {
			name: string;
			type: "positive" | "negative";
			confidence?: number;
		}[],
		source?: string,
		tx?: Transaction,
	): Promise<void>;
};
