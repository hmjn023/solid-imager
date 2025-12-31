import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock @solidjs/router
vi.mock("@solidjs/router", () => ({
  cache: (fn: any, _name: any) => fn,
}));

// Mock side-effects to prevent real file system operations
vi.mock("~/application/services/media-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking exported class/object name
  MediaService: {
    registerExistingMedia: vi.fn(),
  },
}));

vi.mock("~/infrastructure/jobs/file-watcher-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking exported class/object name
  FileWatcherService: {
    startMonitoring: vi.fn().mockResolvedValue(undefined),
    stopMonitoring: vi.fn().mockResolvedValue(undefined),
  },
}));

// HTTP Status Constants
const HTTP_OK = 200;
const HTTP_CREATED = 201;

// Helper Types
type ApiHandlers = {
  getSources: (event?: any) => Promise<Response>;
  createSource: (event: any) => Promise<Response>;
  getSourceMedia: (event: any) => Promise<Response>;
  updateSource: (event: any) => Promise<Response>;
  deleteSource: (event: any) => Promise<Response>;
};

// Mock APIEvent-like objects
const createPostEvent = (body: any) => ({
  request: new Request("http://localhost/api/sources", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: {},
  nativeEvent: {} as any,
});

const createPutEvent = (id: string, body: any) => ({
  request: new Request(`http://localhost/api/sources/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: { mediaSourceId: id },
  nativeEvent: {} as any,
});

const createDeleteEvent = (id: string) => ({
  request: new Request(`http://localhost/api/sources/${id}`, {
    method: "DELETE",
  }),
  params: { mediaSourceId: id },
  nativeEvent: {} as any,
});

describe("Media Source API (Direct Handler)", () => {
  let handlers: ApiHandlers;
  let createdSourceId: string;

  beforeAll(async () => {
    // Dynamic import to ensure mock is applied first
    const sourceIndex = await import("~/routes/api/sources/index");
    const sourceIdIndex = await import(
      "~/routes/api/sources/[mediaSourceId]/index"
    );

    handlers = {
      getSources: sourceIndex.GET,
      createSource: sourceIndex.POST,
      getSourceMedia: sourceIdIndex.GET,
      updateSource: sourceIdIndex.PUT,
      deleteSource: sourceIdIndex.DELETE,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new media source", async () => {
    const newSource = {
      name: "Test Source Direct",
      description: "Test Description",
      type: "local",
      connectionInfo: {
        path: "/tmp/test-media", // Safe now due to mocking
      },
    };

    const response = await handlers.createSource(createPostEvent(newSource));
    const data = await response.json();

    if (response.status !== HTTP_CREATED) {
      console.error("Create failed:", data);
    }

    expect(response.status).toBe(HTTP_CREATED);
    expect(data.name).toBe(newSource.name);
    expect(data.id).toBeDefined();
    createdSourceId = data.id;
  });

  it("should list all media sources and find the created one", async () => {
    const response = await handlers.getSources();
    expect(response.status).toBe(HTTP_OK);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((s: any) => s.id === createdSourceId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Source Direct");
  });

  it("should update a media source", async () => {
    if (!createdSourceId) {
      throw new Error("No source created");
    }

    const updateData = {
      name: "Updated Test Source Direct",
    };

    const response = await handlers.updateSource(
      createPutEvent(createdSourceId, updateData)
    );
    const data = await response.json();

    if (response.status !== HTTP_OK) {
      console.error("Update failed:", data);
    }

    expect(response.status).toBe(HTTP_OK);
    expect(data.name).toBe(updateData.name);
  });

  it("should delete a media source", async () => {
    if (!createdSourceId) {
      throw new Error("No source created");
    }

    const response = await handlers.deleteSource(
      createDeleteEvent(createdSourceId)
    );
    expect(response.status).toBe(HTTP_OK);

    // Verify it's gone from list
    const listResponse = await handlers.getSources();
    const listData = await listResponse.json();
    const found = listData.find((s: any) => s.id === createdSourceId);
    expect(found).toBeUndefined();
  });
});
