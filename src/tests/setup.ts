import path from "node:path";
import { config } from "dotenv";
import { vi } from "vitest";

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), ".env") });

vi.mock("~/infrastructure/db/index", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: "mock-uuid-1",
            sourceId: "b0000000-0000-4000-8000-000000000000",
            filePath: "/mock/path/image.png",
            fileName: "image.png",
            mediaType: "image",
            width: 800,
            height: 600,
            fileSize: 1024,
            createdAt: new Date(),
            modifiedAt: new Date(),
            indexedAt: new Date(),
          },
        ]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => [
          {
            id: "mock-uuid-123",
            sourceId: "b0000000-0000-4000-8000-000000000000",
            filePath: "/mock/path/image.png",
            fileName: "image.png",
            mediaType: "image",
            width: 800,
            height: 600,
            fileSize: 1024,
            createdAt: new Date(),
            modifiedAt: new Date(),
            indexedAt: new Date(),
          },
        ]),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => [
            {
              id: "mock-uuid-123",
              sourceId: "b0000000-0000-4000-8000-000000000000",
              filePath: "/mock/path/image.png",
              fileName: "updated_image.png",
              mediaType: "image",
              width: 1024,
              height: 768,
              fileSize: 1024,
              createdAt: new Date(),
              modifiedAt: new Date(),
              indexedAt: new Date(),
            },
          ]),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: "mock-uuid-123",
            sourceId: "b0000000-0000-4000-8000-000000000000",
            filePath: "/mock/path/image.png",
            fileName: "image.png",
            mediaType: "image",
            width: 800,
            height: 600,
            fileSize: 1024,
            createdAt: new Date(),
            modifiedAt: new Date(),
            indexedAt: new Date(),
          },
        ]),
      })),
    })),
  },
  pool: {
    end: vi.fn(),
    connect: vi.fn(() => ({
      query: vi.fn(),
      release: vi.fn(),
    })),
  },
  deleteCategory: vi.fn(() => Promise.resolve([])),
  deleteCharacter: vi.fn(() => Promise.resolve([])),
  deleteIp: vi.fn(() => Promise.resolve([])),
  deleteMedia: vi.fn(() => Promise.resolve([])),
  deleteMediaByPath: vi.fn(() => Promise.resolve([])),
  deleteMediaSource: vi.fn(() => Promise.resolve([])),
  globalSearchMedia: vi.fn(() => Promise.resolve([])),
  insertCategory: vi.fn(() => Promise.resolve([])),
  insertCharacter: vi.fn(() => Promise.resolve([])),
  insertIp: vi.fn(() => Promise.resolve([])),
  insertMedia: vi.fn(() => Promise.resolve([])),
  insertMediaSource: vi.fn(() => Promise.resolve([])),
  searchMedia: vi.fn(() => Promise.resolve([])),
  searchMediaInDirectory: vi.fn(() => Promise.resolve([])),
  selectCategories: vi.fn(() => Promise.resolve([])),
  selectCategoryById: vi.fn(() => Promise.resolve([])),
  selectCharacterById: vi.fn(() => Promise.resolve([])),
  selectCharacters: vi.fn(() => Promise.resolve([])),
  selectIpById: vi.fn(() => Promise.resolve([])),
  selectIps: vi.fn(() => Promise.resolve([])),
  selectMediaById: vi.fn(() => Promise.resolve([])),
  selectMediaBySourceId: vi.fn(() => Promise.resolve([])),
  selectMediaBySourceIdAndDirectoryPath: vi.fn(() => Promise.resolve([])),
  selectMediaBySourceIdAndFilePath: vi.fn(() => Promise.resolve([])),
  selectMediaGenerationInfoById: vi.fn(() => Promise.resolve([])),
  selectMediaSourceById: vi.fn(() => Promise.resolve([])),
  selectMediaSources: vi.fn(() => Promise.resolve([])),
  selectThumbnailJobStatus: vi.fn(() => Promise.resolve([])),
  updateCategory: vi.fn(() => Promise.resolve([])),
  updateCharacter: vi.fn(() => Promise.resolve([])),
  updateIp: vi.fn(() => Promise.resolve([])),
  updateMedia: vi.fn(() => Promise.resolve([])),
  updateMediaGenerationInfo: vi.fn(() => Promise.resolve([])),
  updateMediaSource: vi.fn(() => Promise.resolve([])),
}));
