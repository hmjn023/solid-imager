/**
 * API endpoint constants
 * Centralized API endpoint definitions to avoid hardcoding
 */

export const API_ENDPOINTS = {
  // Sources
  sources: "/api/sources",
  sourceDetail: (sourceId: string) => `/api/sources/${sourceId}`,

  // Media
  mediaList: (sourceId: string) => `/api/sources/${sourceId}`,
  mediaDetails: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/details`,
  mediaThumbnail: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/thumbnail`,
  mediaUpload: (sourceId: string) => `/api/sources/${sourceId}/upload`,

  // Tags
  tags: "/api/tags",

  // Search
  mediaSearch: (sourceId: string) => `/api/sources/${sourceId}/search`,

  // Utilities
  fetchUrl: "/api/fetch-url",
} as const;
