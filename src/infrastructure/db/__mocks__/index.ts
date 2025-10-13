import { v4 as uuidv4 } from "uuid";
import { vi } from "vitest";

export const db = {
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(() => [
        {
          id: uuidv4(),
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
};

export const pool = {
  end: vi.fn(),
  connect: vi.fn(() => ({
    query: vi.fn(),
    release: vi.fn(),
  })),
};
