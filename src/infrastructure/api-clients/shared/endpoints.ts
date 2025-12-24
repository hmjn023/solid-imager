/**
 * API endpoint constants
 * Centralized API endpoint definitions to avoid hardcoding
 */

export const API_ENDPOINTS = {
  // Sources
  sources: "/api/sources",
  sourceDetail: (sourceId: string) => `/api/sources/${sourceId}`,
  sourceDump: (sourceId: string) => `/api/sources/${sourceId}/dump`,
  sourceRestore: (sourceId: string) => `/api/sources/${sourceId}/restore`,
  sourceImport: (sourceId: string) => `/api/sources/${sourceId}/import`,

  // Media
  mediaList: (sourceId: string) => `/api/sources/${sourceId}`,
  mediaDetails: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/details`,
  mediaUpdate: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}`,
  mediaThumbnail: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/thumbnail`,
  mediaUpload: (sourceId: string) => `/api/sources/${sourceId}/upload`,
  mediaCopy: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/copy`,
  mediaMove: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/move`,

  // Tags
  tags: "/api/tags",

  // Search
  mediaSearch: (sourceId: string) => `/api/sources/${sourceId}/search`,

  // Utilities
  fetchUrl: "/api/fetch-url",
  downloads: "/api/downloads",

  // Projects
  projects: "/api/projects",
  mediaProjects: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/projects`,

  // IPs
  ips: "/api/ips",
  mediaIps: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/ips`,

  // Characters
  characters: "/api/characters",
  mediaCharacters: (sourceId: string, mediaId: string) =>
    `/api/sources/${sourceId}/${mediaId}/characters`,

  // AI
  aiTag: "/api/ai/tag",
} as const;
