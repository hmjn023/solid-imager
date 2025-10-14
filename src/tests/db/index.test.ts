import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Effect, Layer, Context } from "effect";
import { pipe } from "effect/Function";
import { pool, DatabaseLive } from "~/infrastructure/db/index";
import { DatabaseService } from "~/infrastructure/db/layer";
import {
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource,
  deleteMediaSource,
} from "~/infrastructure/db/index";
import type { Media, NewMedia, NewMediaSource, MediaGenerationInfo, Category, NewCategory, Character, NewCharacter, Ip, NewIp } from "~/infrastructure/db/schema";
import { mediaSources, medias, mediaGenerationInfo, thumbnailJobs, tags, mediaTags, categories, characters, ips } from "~/infrastructure/db/schema";
import {
  selectMediaById,
  selectMediaBySourceIdAndFilePath,
  insertMedia,
  updateMedia,
  deleteMedia,
  selectMediaBySourceIdAndDirectoryPath,
  selectMediaBySourceId,
  selectMediaGenerationInfoById,
  updateMediaGenerationInfo,
  selectThumbnailJobStatus,
  searchMedia,
  searchMediaInDirectory,
  globalSearchMedia,
  deleteMediaByPath,
  selectCategories,
  insertCategory,
  selectCategoryById,
  updateCategory,
  deleteCategory,
  selectCharacters,
  insertCharacter,
  selectCharacterById,
  updateCharacter,
  deleteCharacter,
  selectIps,
  insertIp,
  selectIpById,
  updateIp,
  deleteIp,
} from "~/infrastructure/db/index";
import { NotFoundError, ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";

// Mock the Drizzle ORM db object
const mockDb = {
  select: vi.fn(() => Promise.resolve([])),
  insert: vi.fn(() => Promise.resolve([])),
  update: vi.fn(() => Promise.resolve([])),
  delete: vi.fn(() => Promise.resolve([])),
  query: {
    mediaSources: {
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
  },
  transaction: vi.fn((fn) => fn(mockDb)),
  returning: vi.fn(() => Promise.resolve([])), // Add returning for update operations
};

// Create a mock DatabaseService Layer
const MockDatabaseLive = Layer.succeed(DatabaseService, Context.make(DatabaseService, { db: mockDb as any }));

describe("Media Generation Info Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
    mockDb.update.mockClear();
  });

  it("selectMediaGenerationInfoById should return generation info on success", async () => {
    const genInfo = { mediaId: "media1", metadata: { prompt: "test" } };
    mockDb.select.mockResolvedValueOnce([genInfo]);
    const result = await Effect.runPromise(pipe(selectMediaGenerationInfoById("media1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(genInfo);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaGenerationInfoById should return NotFoundError if info not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectMediaGenerationInfoById("non-existent"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaGenerationInfoById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaGenerationInfoById("media1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("updateMediaGenerationInfo should update generation info on success", async () => {
    const updatedInfo = { mediaId: "media1", metadata: { prompt: "updated" } };
    mockDb.update.mockResolvedValueOnce([updatedInfo]);
    const result = await Effect.runPromise(pipe(updateMediaGenerationInfo("media1", { prompt: "updated" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedInfo]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMediaGenerationInfo should return NotFoundError if info not found", async () => {
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateMediaGenerationInfo("non-existent", { prompt: "updated" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMediaGenerationInfo should return UnknownDbError on failure", async () => {
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateMediaGenerationInfo("media1", { prompt: "updated" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("Media Source Database Operations", () => {
  beforeAll(async () => {
    // await db.delete(mediaSources);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mockDb state if necessary for each test
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
    mockDb.query.mediaSources.findFirst.mockClear();
    mockDb.transaction.mockClear();
  });

  it("selectMediaSources should return a list of media sources on success", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(selectMediaSources(), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaSources should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaSources(), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaSourceById should return a media source on success", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    mockDb.select.mockResolvedValueOnce([newSource]);
    const result = await Effect.runPromise(pipe(selectMediaSourceById("1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(newSource);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaSourceById should return NotFoundError if source not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaSourceById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaSourceById("1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertMediaSource should insert a new media source on success", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    mockDb.insert.mockResolvedValueOnce([newSource]);
    const result = await Effect.runPromise(pipe(insertMediaSource(newSource), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([newSource]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertMediaSource should return ConstraintError on duplicate entry", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    mockDb.insert.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(insertMediaSource(newSource), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertMediaSource should return UnknownDbError on failure", async () => {
    mockDb.insert.mockRejectedValueOnce(new Error("DB error"));
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    const result = await Effect.runPromiseExit(pipe(insertMediaSource(newSource), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updateMediaSource should update an existing media source on success", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    mockDb.update.mockResolvedValueOnce([newSource]);
    const updatedSource = { ...newSource, name: "updated_test" };
    const result = await Effect.runPromise(pipe(updateMediaSource("1", updatedSource), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedSource]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMediaSource should return NotFoundError if source not found", async () => {
    const updatedSource = { id: "non-existent", name: "updated_test", type: "local", connectionInfo: {} };
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateMediaSource("non-existent", updatedSource), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMediaSource should return ConstraintError on duplicate entry", async () => {
    const source1: NewMediaSource = { id: "1", name: "test1", type: "local", connectionInfo: {} };
    const updatedSource = { ...source1, name: "test2" };
    const result = await Effect.runPromiseExit(pipe(updateMediaSource("1", updatedSource), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMediaSource should return UnknownDbError on failure", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    const updatedSource = { ...newSource, name: "updated_test" };
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateMediaSource("1", updatedSource), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deleteMediaSource should delete an existing media source on success", async () => {
    const newSource: NewMediaSource = { id: "1", name: "test", type: "local", connectionInfo: {} };
    mockDb.delete.mockResolvedValueOnce([newSource]);
    const result = await Effect.runPromise(pipe(deleteMediaSource("1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([newSource]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMediaSource should return NotFoundError if source not found", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(deleteMediaSource("non-existent"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMediaSource should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteMediaSource("1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("Media Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
  });

  it("selectMediaById should return a media item on success", async () => {
    const media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    mockDb.select.mockResolvedValueOnce([media]);
    const result = await Effect.runPromise(pipe(selectMediaById("media1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(media);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaById should return NotFoundError if media not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectMediaById("non-existent"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaById("media1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndFilePath should return a media item on success", async () => {
    const media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    mockDb.select.mockResolvedValueOnce([media]);
    const result = await Effect.runPromise(pipe(selectMediaBySourceIdAndFilePath("1", "/test.png"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(media);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndFilePath should return NotFoundError if media not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectMediaBySourceIdAndFilePath("1", "/non-existent.png"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndFilePath should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaBySourceIdAndFilePath("1", "/test.png"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertMedia should insert a new media item on success", async () => {
    const newMedia: NewMedia = { id: "media2", sourceId: "1", filePath: "/new.png", fileName: "new.png" };
    mockDb.insert.mockResolvedValueOnce([newMedia]);
    const result = await Effect.runPromise(pipe(insertMedia(newMedia), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([newMedia]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertMedia should return ConstraintError on duplicate entry", async () => {
    const newMedia: NewMedia = { id: "media2", sourceId: "1", filePath: "/new.png", fileName: "new.png" };
    mockDb.insert.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(insertMedia(newMedia), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertMedia should return UnknownDbError on failure", async () => {
    const newMedia: NewMedia = { id: "media2", sourceId: "1", filePath: "/new.png", fileName: "new.png" };
    mockDb.insert.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(insertMedia(newMedia), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("updateMedia should update an existing media item on success", async () => {
    const media: Media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    mockDb.update.mockResolvedValueOnce([media]);
    const updatedMedia = { ...media, fileName: "updated.png" };
    const result = await Effect.runPromise(pipe(updateMedia("media1", updatedMedia), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedMedia]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMedia should return NotFoundError if media not found", async () => {
    const updatedMedia: Media = { id: "non-existent", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateMedia("non-existent", updatedMedia), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMedia should return ConstraintError on duplicate entry", async () => {
    const media: Media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    const updatedMedia = { ...media, filePath: "/existing.png" };
    mockDb.update.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(updateMedia("media1", updatedMedia), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateMedia should return UnknownDbError on failure", async () => {
    const media: Media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    const updatedMedia = { ...media, fileName: "updated.png" };
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateMedia("media1", updatedMedia), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deleteMedia should delete an existing media item on success", async () => {
    const media: Media = { id: "media1", sourceId: "1", filePath: "/test.png", fileName: "test.png" };
    mockDb.delete.mockResolvedValueOnce([media]);
    const result = await Effect.runPromise(pipe(deleteMedia("media1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMedia should return NotFoundError if media not found", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(deleteMedia("non-existent"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMedia should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteMedia("media1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndDirectoryPath should return a list of media items on success", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/dir/test1.png", fileName: "test1.png" };
    const media2 = { id: "media2", sourceId: "1", filePath: "/dir/test2.png", fileName: "test2.png" };
    mockDb.select.mockResolvedValueOnce([media1, media2]);
    const result = await Effect.runPromise(pipe(selectMediaBySourceIdAndDirectoryPath("1", "/dir/"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1, media2]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndDirectoryPath should return an empty array if no media found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(selectMediaBySourceIdAndDirectoryPath("1", "/empty/"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceIdAndDirectoryPath should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaBySourceIdAndDirectoryPath("1", "/dir/"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceId should return a list of media items on success", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/test1.png", fileName: "test1.png" };
    const media2 = { id: "media2", sourceId: "1", filePath: "/test2.png", fileName: "test2.png" };
    mockDb.select.mockResolvedValueOnce([media1, media2]);
    const result = await Effect.runPromise(pipe(selectMediaBySourceId("1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1, media2]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceId should return an empty array if no media found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(selectMediaBySourceId("non-existent-source"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectMediaBySourceId should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectMediaBySourceId("1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });
});

describe("Thumbnail Job Status Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
  });

  it("selectThumbnailJobStatus should return job status on success", async () => {
    const jobStatus = { id: "job1", sourceId: "1", status: "processing" };
    mockDb.select.mockResolvedValueOnce([jobStatus]);
    const result = await Effect.runPromise(pipe(selectThumbnailJobStatus("1"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([jobStatus]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectThumbnailJobStatus should return an empty array if no job status found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(selectThumbnailJobStatus("non-existent"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectThumbnailJobStatus should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectThumbnailJobStatus("1"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });
});

describe("Search Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
  });

  it("searchMedia should return a list of media items based on query and tags", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/test1.png", fileName: "test1.png", description: "a test image" };
    const media2 = { id: "media2", sourceId: "1", filePath: "/test2.png", fileName: "test2.png", description: "another image" };
    mockDb.select.mockResolvedValueOnce([media1, media2]);
    const result = await Effect.runPromise(pipe(searchMedia("1", { query: "test", tags: ["tag1"] }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1, media2]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("searchMedia should return an empty array if no media found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(searchMedia("1", { query: "non-existent" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("searchMedia should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(searchMedia("1", { query: "test" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("searchMediaInDirectory should return a list of media items based on query and tags within a directory", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/dir/test1.png", fileName: "test1.png", description: "a test image" };
    mockDb.select.mockResolvedValueOnce([media1]);
    const result = await Effect.runPromise(pipe(searchMediaInDirectory("1", "/dir/", { query: "test" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("searchMediaInDirectory should return an empty array if no media found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(searchMediaInDirectory("1", "/empty/", { query: "non-existent" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("searchMediaInDirectory should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(searchMediaInDirectory("1", "/dir/", { query: "test" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("globalSearchMedia should return a list of media items based on query and tags globally", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/test1.png", fileName: "test1.png", description: "a test image" };
    mockDb.select.mockResolvedValueOnce([media1]);
    const result = await Effect.runPromise(pipe(globalSearchMedia({ query: "test" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("globalSearchMedia should return an empty array if no media found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(globalSearchMedia({ query: "non-existent" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("globalSearchMedia should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(globalSearchMedia({ query: "test" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });
});

describe("Directory Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.delete.mockClear();
  });

  it("deleteMediaByPath should delete media items in a given path on success", async () => {
    const media1 = { id: "media1", sourceId: "1", filePath: "/dir/test1.png", fileName: "test1.png" };
    mockDb.delete.mockResolvedValueOnce([media1]);
    const result = await Effect.runPromise(pipe(deleteMediaByPath("1", "/dir/"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([media1]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMediaByPath should return an empty array if no media found to delete", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromise(pipe(deleteMediaByPath("1", "/empty/"), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteMediaByPath should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteMediaByPath("1", "/dir/"), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("Category Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
  });

  it("selectCategories should return a list of categories on success", async () => {
    const category1 = { id: 1, name: "Category 1" };
    mockDb.select.mockResolvedValueOnce([category1]);
    const result = await Effect.runPromise(pipe(selectCategories(), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([category1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCategories should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectCategories(), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertCategory should insert a new category on success", async () => {
    const newCategory: NewCategory = { name: "New Category" };
    const insertedCategory = { id: 2, ...newCategory };
    mockDb.insert.mockResolvedValueOnce([insertedCategory]);
    const result = await Effect.runPromise(pipe(insertCategory(newCategory), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([insertedCategory]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertCategory should return ConstraintError on duplicate entry", async () => {
    const newCategory: NewCategory = { name: "Existing Category" };
    mockDb.insert.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(insertCategory(newCategory), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertCategory should return UnknownDbError on failure", async () => {
    const newCategory: NewCategory = { name: "New Category" };
    mockDb.insert.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(insertCategory(newCategory), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("selectCategoryById should return a category on success", async () => {
    const category = { id: 1, name: "Category 1" };
    mockDb.select.mockResolvedValueOnce([category]);
    const result = await Effect.runPromise(pipe(selectCategoryById(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(category);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCategoryById should return NotFoundError if category not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectCategoryById(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCategoryById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectCategoryById(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("updateCategory should update an existing category on success", async () => {
    const updatedCategory = { id: 1, name: "Updated Category" };
    mockDb.update.mockResolvedValueOnce([updatedCategory]);
    const result = await Effect.runPromise(pipe(updateCategory(1, { name: "Updated Category" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedCategory]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCategory should return NotFoundError if category not found", async () => {
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateCategory(99, { name: "Updated Category" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCategory should return ConstraintError on duplicate entry", async () => {
    mockDb.update.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(updateCategory(1, { name: "Existing Category" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCategory should return UnknownDbError on failure", async () => {
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateCategory(1, { name: "Updated Category" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deleteCategory should delete an existing category on success", async () => {
    const deletedCategory = { id: 1, name: "Category 1" };
    mockDb.delete.mockResolvedValueOnce([deletedCategory]);
    const result = await Effect.runPromise(pipe(deleteCategory(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([deletedCategory]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteCategory should return NotFoundError if category not found", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(deleteCategory(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteCategory should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteCategory(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("Character Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
  });

  it("selectCharacters should return a list of characters on success", async () => {
    const character1 = { id: 1, name: "Character 1" };
    mockDb.select.mockResolvedValueOnce([character1]);
    const result = await Effect.runPromise(pipe(selectCharacters(), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([character1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCharacters should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectCharacters(), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertCharacter should insert a new character on success", async () => {
    const newCharacter: NewCharacter = { name: "New Character" };
    const insertedCharacter = { id: 2, ...newCharacter };
    mockDb.insert.mockResolvedValueOnce([insertedCharacter]);
    const result = await Effect.runPromise(pipe(insertCharacter(newCharacter), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([insertedCharacter]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertCharacter should return ConstraintError on duplicate entry", async () => {
    const newCharacter: NewCharacter = { name: "Existing Character" };
    mockDb.insert.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(insertCharacter(newCharacter), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertCharacter should return UnknownDbError on failure", async () => {
    const newCharacter: NewCharacter = { name: "New Character" };
    mockDb.insert.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(insertCharacter(newCharacter), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("selectCharacterById should return a character on success", async () => {
    const character = { id: 1, name: "Character 1" };
    mockDb.select.mockResolvedValueOnce([character]);
    const result = await Effect.runPromise(pipe(selectCharacterById(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(character);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCharacterById should return NotFoundError if character not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectCharacterById(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectCharacterById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectCharacterById(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("updateCharacter should update an existing character on success", async () => {
    const updatedCharacter = { id: 1, name: "Updated Character" };
    mockDb.update.mockResolvedValueOnce([updatedCharacter]);
    const result = await Effect.runPromise(pipe(updateCharacter(1, { name: "Updated Character" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedCharacter]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCharacter should return NotFoundError if character not found", async () => {
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateCharacter(99, { name: "Updated Character" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCharacter should return ConstraintError on duplicate entry", async () => {
    mockDb.update.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(updateCharacter(1, { name: "Existing Character" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateCharacter should return UnknownDbError on failure", async () => {
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateCharacter(1, { name: "Updated Character" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deleteCharacter should delete an existing character on success", async () => {
    const deletedCharacter = { id: 1, name: "Character 1" };
    mockDb.delete.mockResolvedValueOnce([deletedCharacter]);
    const result = await Effect.runPromise(pipe(deleteCharacter(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([deletedCharacter]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteCharacter should return NotFoundError if character not found", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(deleteCharacter(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteCharacter should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteCharacter(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe("IP Database Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockClear();
    mockDb.insert.mockClear();
    mockDb.update.mockClear();
    mockDb.delete.mockClear();
  });

  it("selectIps should return a list of IPs on success", async () => {
    const ip1 = { id: 1, name: "IP 1" };
    mockDb.select.mockResolvedValueOnce([ip1]);
    const result = await Effect.runPromise(pipe(selectIps(), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([ip1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectIps should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectIps(), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("insertIp should insert a new IP on success", async () => {
    const newIp: NewIp = { name: "New IP" };
    const insertedIp = { id: 2, ...newIp };
    mockDb.insert.mockResolvedValueOnce([insertedIp]);
    const result = await Effect.runPromise(pipe(insertIp(newIp), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([insertedIp]);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertIp should return ConstraintError on duplicate entry", async () => {
    const newIp: NewIp = { name: "Existing IP" };
    mockDb.insert.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(insertIp(newIp), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("insertIp should return UnknownDbError on failure", async () => {
    const newIp: NewIp = { name: "New IP" };
    mockDb.insert.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(insertIp(newIp), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("selectIpById should return an IP on success", async () => {
    const ip = { id: 1, name: "IP 1" };
    mockDb.select.mockResolvedValueOnce([ip]);
    const result = await Effect.runPromise(pipe(selectIpById(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual(ip);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectIpById should return NotFoundError if IP not found", async () => {
    mockDb.select.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(selectIpById(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("selectIpById should return UnknownDbError on failure", async () => {
    mockDb.select.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(selectIpById(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("updateIp should update an existing IP on success", async () => {
    const updatedIp = { id: 1, name: "Updated IP" };
    mockDb.update.mockResolvedValueOnce([updatedIp]);
    const result = await Effect.runPromise(pipe(updateIp(1, { name: "Updated IP" }), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([updatedIp]);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateIp should return NotFoundError if IP not found", async () => {
    mockDb.update.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(updateIp(99, { name: "Updated IP" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateIp should return ConstraintError on duplicate entry", async () => {
    mockDb.update.mockRejectedValueOnce({ code: "23505" });
    const result = await Effect.runPromiseExit(pipe(updateIp(1, { name: "Existing IP" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(ConstraintError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("updateIp should return UnknownDbError on failure", async () => {
    mockDb.update.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(updateIp(1, { name: "Updated IP" }), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("deleteIp should delete an existing IP on success", async () => {
    const deletedIp = { id: 1, name: "IP 1" };
    mockDb.delete.mockResolvedValueOnce([deletedIp]);
    const result = await Effect.runPromise(pipe(deleteIp(1), Layer.provide(MockDatabaseLive)));
    expect(result).toEqual([deletedIp]);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteIp should return NotFoundError if IP not found", async () => {
    mockDb.delete.mockResolvedValueOnce([]);
    const result = await Effect.runPromiseExit(pipe(deleteIp(99), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(NotFoundError);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("deleteIp should return UnknownDbError on failure", async () => {
    mockDb.delete.mockRejectedValueOnce(new Error("DB error"));
    const result = await Effect.runPromiseExit(pipe(deleteIp(1), Layer.provide(MockDatabaseLive)));
    expect(result._tag).toBe("Failure");
    expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
