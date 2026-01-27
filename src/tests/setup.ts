import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, vi } from "vitest";

// Mock logger module to include updateLogLevel
vi.mock("~/infrastructure/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/infrastructure/logger")>();
  return {
    ...actual,
    updateLogLevel: vi.fn(),
  };
});

// サービス登録を全テスト開始前に行う
beforeAll(async () => {
  const { bootstrap } = await import("~/infrastructure/bootstrap");
  bootstrap();
});

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), ".env") });

// テスト環境では必ずPGliteを使用
// vitest.config.tsで設定されるが、念のため再度設定
process.env.DB_HOST = "pglite";

// PostgreSQL接続情報が設定されていても無視する
// テスト実行時は常にPGliteを使用し、外部DBへの依存を排除
if (process.env.NODE_ENV !== "production") {
  // テスト環境であることを明示
  process.env.NODE_ENV = "test";
}

// モックされたdbオブジェクトを作成
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
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
    transaction: vi.fn((fn) => fn(null)), // Placeholder for recursive mockDb if needed, but usually fn(db)
  },
}));

// Fix transaction to use mockDb
mockDb.transaction = vi.fn((fn) => fn(mockDb));

// ~/infrastructure/db/index のモックを条件付きで設定
vi.mock("~/infrastructure/db/index", async (_importOriginal) => {
  // 統合テストファイルのパターンを判定
  const isIntegrationTest = (filePath: string) =>
    filePath.includes("/integration/") || filePath.includes("/tests/api/");

  // テストファイルのパスを取得（グローバル変数から）
  // @ts-expect-error - accessing internal test state
  const testPath = globalThis.__vitest_worker__?.filepath || "";

  if (isIntegrationTest(testPath)) {
    // 統合テストの場合は新しいPGLiteインスタンスを使用
    // schemaを動的にインポートしてホイスティングの問題を回避
    const schema = await import("~/infrastructure/db/schema");
    const client = new PGlite();
    const testDb = drizzle(client, { schema });
    await migrate(testDb, { migrationsFolder: "./drizzle" });
    return { db: testDb };
  }

  // ユニットテストの場合はモックを使用
  return { db: mockDb };
});

// 各テストの前にモックをクリア
beforeEach(() => {
  vi.clearAllMocks();
});
