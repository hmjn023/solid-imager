import type {
	MediaSearchRequest,
	MediaSearchResponse,
} from "@solid-imager/core/domain/media/schemas";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SearchOptions } from "../ports/search-service";

const DEFAULT_PAGE_LIMIT = 20;

export class SearchServiceImpl {
	private readonly mediaRepository: IMediaRepository;

	constructor(mediaRepository: IMediaRepository) {
		this.mediaRepository = mediaRepository;
	}

	async globalSearchMedia(
		searchOptions: SearchOptions,
	): Promise<MediaSearchResponse> {
		const limit = searchOptions.limit || DEFAULT_PAGE_LIMIT;
		const offset = searchOptions.page ? (searchOptions.page - 1) * limit : 0;

		let sort: NonNullable<MediaSearchRequest["sort"]>;
		switch (searchOptions.sortBy) {
			case "date":
			case "name":
			case "size":
			case "modifiedAt":
			case "indexedAt":
			case "resolution":
			case "rating":
			case "viewCount":
				sort = searchOptions.sortBy;
				break;
			default:
				sort = "date";
		}

		const request: MediaSearchRequest = {
			condition:
				searchOptions.tags && searchOptions.tags.length > 0
					? {
							type: "group",
							operator: "and",
							children: searchOptions.tags.map((tag) => ({
								type: "criterion",
								target: "tag",
								operator: "equals",
								value: tag,
							})),
						}
					: undefined,
			sort,
			order: searchOptions.order || "desc",
			limit,
			offset,
		};

		return await this.mediaRepository.globalSearch(request);
	}
}
