import path from "node:path";
import { config } from "dotenv";
import { beforeEach, vi } from "vitest";

// Load env vars
config({ path: path.resolve(process.cwd(), ".env") });

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_ENV = "test";
}

// Mock DB with valid UUIDs
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => [
          {
            id: "11111111-1111-4111-8111-111111111111",
            mediaSourceId: "22222222-2222-4222-8222-222222222222",
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
            id: "33333333-3333-4333-8333-333333333333",
            mediaSourceId: "22222222-2222-4222-8222-222222222222",
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
              id: "33333333-3333-4333-8333-333333333333",
              mediaSourceId: "22222222-2222-4222-8222-222222222222",
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
            id: "33333333-3333-4333-8333-333333333333",
            mediaSourceId: "22222222-2222-4222-8222-222222222222",
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
    transaction: vi.fn((fn) => fn(null)),
  },
}));

// Fix transaction to use mockDb
mockDb.transaction = vi.fn((fn) => fn(mockDb));

// Mock the DB module for unit tests
vi.mock("~/infrastructure/db/index", () => ({
  db: mockDb,
}));

beforeEach(() => {
  vi.clearAllMocks();
});
