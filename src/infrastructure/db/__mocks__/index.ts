import { vi } from "vitest";
import * as actualSchema from "../schema";

let mockDbState: { mediaSources: any[]; medias: any[] };

export const resetMockDbState = () => {
  mockDbState = { mediaSources: [], medias: [] };
};

resetMockDbState(); // Initialize for the first run

export const insertMediaSource = vi.fn((mediaSource) => {
  const newEntry = { id: `mock-uuid-${mockDbState.mediaSources.length + 1}`, ...mediaSource };
  mockDbState.mediaSources.push(newEntry);
  return Promise.resolve([newEntry]);
});

export const selectMediaSourceById = vi.fn((id: string) => {
  return Promise.resolve(mockDbState.mediaSources.filter((s) => s.id === id));
});

export const selectMediaSources = vi.fn(() => {
  return Promise.resolve(mockDbState.mediaSources);
});

export const updateMediaSource = vi.fn((id: string, mediaSource) => {
  const index = mockDbState.mediaSources.findIndex((s) => s.id === id);
  if (index !== -1) {
    mockDbState.mediaSources[index] = { ...mockDbState.mediaSources[index], ...mediaSource };
    return Promise.resolve([mockDbState.mediaSources[index]]);
  }
  return Promise.resolve([]);
});

export const deleteMediaSource = vi.fn((id: string) => {
  const initialLength = mockDbState.mediaSources.length;
  mockDbState.mediaSources = mockDbState.mediaSources.filter((s) => s.id !== id);
  if (mockDbState.mediaSources.length < initialLength) {
    return Promise.resolve([{ id }]);
  }
  return Promise.resolve([]);
});

export const selectMediaBySourceIdAndFilePath = vi.fn((sourceId: string, filePath: string) => {
  return Promise.resolve(mockDbState.medias.filter(m => m.sourceId === sourceId && m.filePath === filePath));
});

export const insertMedia = vi.fn((media) => {
  const newEntry = { id: uuidv4(), ...media };
  mockDbState.medias.push(newEntry);
  return Promise.resolve([newEntry]);
});

export const selectMediaById = vi.fn((id: string) => {
  return Promise.resolve(mockDbState.medias.filter(m => m.id === id));
});

export const updateMedia = vi.fn((id: string, media) => {
  const index = mockDbState.medias.findIndex((m) => m.id === id);
  if (index !== -1) {
    mockDbState.medias[index] = { ...mockDbState.medias[index], ...media };
    return Promise.resolve([mockDbState.medias[index]]);
  }
  return Promise.resolve([]);
});

export const deleteMedia = vi.fn((id: string) => {
  const initialLength = mockDbState.medias.length;
  mockDbState.medias = mockDbState.medias.filter((m) => m.id !== id);
  if (mockDbState.medias.length < initialLength) {
    return Promise.resolve([{ id }]);
  }
  return Promise.resolve([]);
});

export const selectMediaBySourceIdAndDirectoryPath = vi.fn((sourceId: string, directoryPath: string) => {
  return Promise.resolve(mockDbState.medias.filter(m => m.sourceId === sourceId && m.filePath.startsWith(directoryPath)));
});

// Mock other functions as needed
export const pool = vi.fn();
export const DatabaseLive = vi.fn();
export const selectMediaBySourceId = vi.fn();
export const selectMediaGenerationInfoById = vi.fn();
export const updateMediaGenerationInfo = vi.fn();
export const selectThumbnailJobStatus = vi.fn();
export const searchMedia = vi.fn();
export const searchMediaInDirectory = vi.fn();
export const globalSearchMedia = vi.fn();
export const deleteMediaByPath = vi.fn();
export const selectCategories = vi.fn();
export const insertCategory = vi.fn();
export const selectCategoryById = vi.fn();
export const updateCategory = vi.fn();
export const deleteCategory = vi.fn();
export const selectCharacters = vi.fn();
export const insertCharacter = vi.fn();
export const selectCharacterById = vi.fn();
export const updateCharacter = vi.fn();
export const deleteCharacter = vi.fn();
export const selectIps = vi.fn();
export const insertIp = vi.fn();
export const selectIpById = vi.fn();
export const updateIp = vi.fn();
export const deleteIp = vi.fn();
export const selectUsers = vi.fn();
export const insertUser = vi.fn();
export const selectUserById = vi.fn();
export const updateUser = vi.fn();
export const deleteUser = vi.fn();
export const selectCollections = vi.fn();
export const insertCollection = vi.fn();
export const selectCollectionById = vi.fn();
export const updateCollection = vi.fn();
export const deleteCollection = vi.fn();
export const insertCollectionMedia = vi.fn();
export const deleteCollectionMedia = vi.fn();
export const bulkUpdateMedia = vi.fn();
export const bulkDeleteMedia = vi.fn();
export const bulkUpdateMediaPaths = vi.fn();
export const bulkAddMediaTags = vi.fn();
export const bulkRemoveMediaTags = vi.fn();
export const insertMediaTags = vi.fn();
export const selectMediaSourceData = vi.fn();
export const upsertMediaSourceData = vi.fn();
export const reconcileMediaSource = vi.fn();
export const cloneMediaData = vi.fn();
export const selectSourceStats = vi.fn();
export const selectGlobalStats = vi.fn();
export const findDuplicateMedia = vi.fn();
export const findSimilarMedia = vi.fn();
export const selectPopularMedia = vi.fn();
export const selectRecentMedia = vi.fn();
