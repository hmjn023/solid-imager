import path from "node:path";
import { config } from "dotenv";
import { vi } from "vitest";

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), ".env") });

// モックされたdbオブジェクトを作成
const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => [
        {
          id: "mock-uuid-1",
          mediaSourceId: "b0000000-0000-4000-8000-000000000000",
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
          mediaSourceId: "b0000000-0000-4000-8000-000000000000",
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
            mediaSourceId: "b0000000-0000-4000-8000-000000000000",
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
          mediaSourceId: "b0000000-0000-4000-8000-000000000000",
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
  query: {
    mediaSources: {
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
  },
  transaction: vi.fn((fn) => fn(mockDb)),
};

// dbをエクスポート (テストから直接インポートできるように)
export const db = mockDb;

export const pool = {
  end: vi.fn(),
  connect: vi.fn(() => ({
    query: vi.fn(),
    release: vi.fn(),
  })),
};

// モックを設定
vi.mock("~/infrastructure/db/__mocks__", () => ({
  addMediaToMockDb: vi.fn(),
  resetMockDbState: vi.fn(),
}));

// ~/infrastructure/db/index をモック
vi.mock("~/infrastructure/db/index", () => ({
  db: mockDb,
}));
