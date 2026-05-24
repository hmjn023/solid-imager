import type { MediaSearchResponse } from "@solid-imager/core/domain/media/schemas";

export type SearchOptions = {
  tags?: string[];
  sortBy?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
};

export interface ISearchService {
  globalSearchMedia(options: SearchOptions): Promise<MediaSearchResponse>;
}
