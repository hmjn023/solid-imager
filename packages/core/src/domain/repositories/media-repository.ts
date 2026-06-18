import type { Transaction } from "@/domain/interfaces/transaction-manager";
import type {
	AddMediaRequest,
	Author,
	FindDuplicatesRequest,
	FindDuplicatesResponse,
	Media,
	MediaDetails,
	MediaGenerationInfo,
	MediaSearchRequest,
	MediaSearchResponse,
	MediaTag,
	MediaUrl,
	UpdateMediaRequest,
} from "@/domain/media/schemas";

export type IMediaRepository = {
	findById(id: string, tx?: Transaction): Promise<Media | null>;
	findByIds(ids: string[], tx?: Transaction): Promise<Media[]>;
	findByPath(
		sourceId: string,
		filePath: string,
		tx?: Transaction,
	): Promise<Media | null>;
	create(media: AddMediaRequest, tx?: Transaction): Promise<Media>;
	upsert(media: AddMediaRequest, tx?: Transaction): Promise<Media>;
	update(
		id: string,
		media: UpdateMediaRequest,
		tx?: Transaction,
	): Promise<Media>;
	delete(id: string, tx?: Transaction): Promise<void>;
	search(
		sourceId: string,
		criteria: MediaSearchRequest,
		tx?: Transaction,
	): Promise<MediaSearchResponse>;

	globalSearch(
		criteria: MediaSearchRequest,
		tx?: Transaction,
	): Promise<MediaSearchResponse>;

	/**
	 * Retrieves full media details (tags, authors, etc.) in a single optimized query.
	 */
	getDetails(mediaId: string, tx?: Transaction): Promise<MediaDetails | null>;

	// Ancillary data
	getTags(mediaId: string, tx?: Transaction): Promise<MediaTag[]>;
	getGenerationInfo(
		mediaId: string,
		tx?: Transaction,
	): Promise<MediaGenerationInfo | null>;
	getAuthors(mediaId: string, tx?: Transaction): Promise<Author[]>;
	getUrls(mediaId: string, tx?: Transaction): Promise<MediaUrl[]>;
	addUrls(
		mediaId: string,
		urls: string[],
		tx?: Transaction,
	): Promise<MediaUrl[]>;
	upsertGenerationInfo(
		mediaId: string,
		prompt: string | null,
		workflow: unknown,
		tx?: Transaction,
	): Promise<MediaGenerationInfo>;

	// Bulk/List
	findAllBySourceId(
		sourceId: string,
		limit?: number,
		offset?: number,
		tx?: Transaction,
	): Promise<Media[]>;
	searchInDirectory(
		sourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
		tx?: Transaction,
	): Promise<Media[]>;
	findExistingUrls(urls: string[], tx?: Transaction): Promise<string[]>;

	// Maintenance
	findIdsWithMissingGenerationInfo(
		tx?: Transaction,
	): Promise<{ id: string; mediaSourceId: string; filePath: string }[]>;
	findAllMediaIndices(
		tx?: Transaction,
		options?: { limit: number; offset?: number; afterId?: string },
	): Promise<{ id: string; mediaSourceId: string; filePath: string }[]>;
	findAllPathsBySourceId(
		sourceId: string,
		tx?: Transaction,
	): Promise<{ id: string; filePath: string }[]>;

	/**
	 * Find duplicate media by filename pattern and source URL matching.
	 */
	findDuplicates(
		request: FindDuplicatesRequest,
		tx?: Transaction,
	): Promise<FindDuplicatesResponse>;

	/**
	 * Check if an existing media item has the exact same set of source URLs.
	 * Returns the mediaId if a match is found, null otherwise.
	 */
	findMediaIdWithMatchingUrlSet(
		urls: string[],
		tx?: Transaction,
	): Promise<string | null>;

	bulkUpdate(
		mediaIds: string[],
		updates: UpdateMediaRequest,
		tx?: Transaction,
	): Promise<void>;
	bulkDelete(mediaIds: string[], tx?: Transaction): Promise<void>;
	bulkUpdatePaths(
		updates: { id: string; filePath: string; fileName: string }[],
		tx?: Transaction,
	): Promise<void>;
	bulkAddTags(
		mediaIds: string[],
		tagIds: string[],
		tx?: Transaction,
	): Promise<void>;
	bulkRemoveTags(
		mediaIds: string[],
		tagIds: string[],
		tx?: Transaction,
	): Promise<void>;
};
