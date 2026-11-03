import type { Transaction } from "../interfaces/transaction-manager";
import type {
	AddMediaRequest,
	FindDuplicatesRequest,
	FindDuplicatesResponse,
	Media,
	MediaDetails,
	MediaActivity,
	MediaPreferencesPatch,
	MediaGenerationInfo,
	MediaSearchRequest,
	MediaSearchResponse,
	MediaTag,
	MediaUrl,
	UpdateMediaRequest,
} from "../media/schemas";
import type { Author } from "../authors/schemas";

import type { LibraryStatistics, StatisticsRequest } from "../media/statistics";

export type MediaReader = {
	findById(id: string, tx?: Transaction): Promise<Media | null>;
	findByIds(ids: string[], tx?: Transaction): Promise<Media[]>;
	findByPath(
		sourceId: string,
		filePath: string,
		tx?: Transaction,
	): Promise<Media | null>;
	findAllBySourceId(
		sourceId: string,
		limit?: number,
		offset?: number,
		tx?: Transaction,
	): Promise<Media[]>;
	findExistingUrls(urls: string[], tx?: Transaction): Promise<string[]>;
	/**
	 * Check if an existing media item has the exact same set of source URLs.
	 * Returns the mediaId if a match is found, null otherwise.
	 */
	findMediaIdWithMatchingUrlSet(
		urls: string[],
		tx?: Transaction,
	): Promise<string | null>;
};

export type MediaWriter = {
	create(media: AddMediaRequest, tx?: Transaction): Promise<Media>;
	upsert(media: AddMediaRequest, tx?: Transaction): Promise<Media>;
	update(
		id: string,
		media: UpdateMediaRequest,
		tx?: Transaction,
	): Promise<Media>;
	delete(id: string, tx?: Transaction): Promise<void>;
	updateActivity(
		sourceId: string,
		mediaId: string,
		change: MediaPreferencesPatch | { viewId: string },
	): Promise<MediaActivity>;
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
};

export type MediaSearchRepository = {
	search(
		sourceId: string,
		criteria: MediaSearchRequest,
		tx?: Transaction,
	): Promise<MediaSearchResponse>;
	globalSearch(
		criteria: MediaSearchRequest,
		tx?: Transaction,
	): Promise<MediaSearchResponse>;
	searchInDirectory(
		sourceId: string,
		directoryPath: string,
		params: { query?: string; tags?: string[] },
		tx?: Transaction,
	): Promise<Media[]>;
	/**
	 * Find duplicate media by filename pattern and source URL matching.
	 */
	findDuplicates(
		request: FindDuplicatesRequest,
		tx?: Transaction,
	): Promise<FindDuplicatesResponse>;
};

export type MediaDetailsReader = {
	/**
	 * Retrieves full media details (tags, authors, etc.) in a single optimized query.
	 */
	getDetails(mediaId: string, tx?: Transaction): Promise<MediaDetails | null>;
	getTags(mediaId: string, tx?: Transaction): Promise<MediaTag[]>;
	getGenerationInfo(
		mediaId: string,
		tx?: Transaction,
	): Promise<MediaGenerationInfo | null>;
	getAuthors(mediaId: string, tx?: Transaction): Promise<Author[]>;
	getUrls(mediaId: string, tx?: Transaction): Promise<MediaUrl[]>;
	getStatistics(input: StatisticsRequest): Promise<LibraryStatistics>;
};

export type MediaMaintenanceRepository = {
	findIdsWithMissingGenerationInfo(
		tx?: Transaction,
	): Promise<{ id: string; mediaSourceId: string; filePath: string }[]>;
	findAllMediaIndices(
		options: { limit: number; offset?: number; afterId?: string },
		tx?: Transaction,
	): Promise<{ id: string; mediaSourceId: string; filePath: string }[]>;
	findAllPathsBySourceId(
		sourceId: string,
		tx?: Transaction,
	): Promise<{ id: string; filePath: string }[]>;
};

export type MediaBulkRepository = {
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

/** All media capabilities supplied by the database adapter at the composition root. */
export type IMediaRepository = MediaReader &
	MediaWriter &
	MediaSearchRepository &
	MediaDetailsReader &
	MediaMaintenanceRepository &
	MediaBulkRepository;
