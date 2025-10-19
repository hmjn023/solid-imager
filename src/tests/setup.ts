import path from "node:path";
import { config } from "dotenv";
import { beforeEach, vi } from "vitest";

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), ".env") });

// 統合テスト用のDB接続情報を設定
if (!process.env.DB_HOST) {
  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "5432";
  process.env.DB_DATABASE = "solid_imager_test";
  process.env.DB_USER = "test";
  process.env.DB_PASSWORD = "test";
}

// モックされたdbオブジェクトを作成
const mockDb = {
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

// モックを設定 - 統合テスト以外でのみ適用
vi.mock("~/infrastructure/db/__mocks__", () => ({
  addMediaToMockDb: vi.fn(),
  resetMockDbState: vi.fn(),
}));

// 統合テストファイルのパターンを判定
const isIntegrationTest = (filePath: string) =>
  filePath.includes("/integration/");

// ~/infrastructure/db/index のモックを条件付きで設定
vi.mock("~/infrastructure/db/index", (importOriginal) => {
  // テストファイルのパスを取得（グローバル変数から）
  // @ts-expect-error - accessing internal test state
  const testPath = globalThis.__vitest_worker__?.filepath || "";

  if (isIntegrationTest(testPath)) {
    // 統合テストの場合は実際のdbを使用
    return importOriginal();
  }

  // ユニット/DBテストの場合はモックを使用
  return { db: mockDb };
});

// 各テストの前にモックをクリア
beforeEach(() => {
  vi.clearAllMocks();
});
