import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Mock @solidjs/router
vi.mock("@solidjs/router", () => ({
  cache: (fn: any, _name: any) => fn,
}));

// HTTP Status Constants
const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_NO_CONTENT = 204;

// Helper Types
type ApiHandlers = {
  getTags: (event?: any) => Promise<Response>;
  createTag: (event: any) => Promise<Response>;
  getTagById: (event: any) => Promise<Response>;
  updateTag: (event: any) => Promise<Response>;
  deleteTag: (event: any) => Promise<Response>;
};

// Mock APIEvent-like objects
const createPostEvent = (body: any) => ({
  request: new Request("http://localhost/api/tags", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: {},
  nativeEvent: {} as any,
});

const createPutEvent = (id: string, body: any) => ({
  request: new Request(`http://localhost/api/tags/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: { id },
  nativeEvent: {} as any,
});

const createDeleteEvent = (id: string) => ({
  request: new Request(`http://localhost/api/tags/${id}`, {
    method: "DELETE",
  }),
  params: { id },
  nativeEvent: {} as any,
});

describe("Tag API (Direct Handler)", () => {
  let handlers: ApiHandlers;
  let createdTagId: string;

  beforeAll(async () => {
    // Dynamic import to ensure mock is applied first
    const tagIndex = await import("~/routes/api/tags/index");
    const tagIdIndex = await import("~/routes/api/tags/[id]");

    handlers = {
      getTags: tagIndex.GET,
      createTag: tagIndex.POST,
      getTagById: tagIdIndex.GET,
      updateTag: tagIdIndex.PUT,
      deleteTag: tagIdIndex.DELETE,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new tag", async () => {
    const newTag = {
      name: "Test Tag",
      description: "Test Description",
      source: "manual",
    };

    const response = await handlers.createTag(createPostEvent(newTag));
    const data = await response.json();

    if (response.status !== HTTP_CREATED) {
      console.error("Create failed:", data);
    }

    expect(response.status).toBe(HTTP_CREATED);
    expect(data.name).toBe(newTag.name);
    expect(data.id).toBeDefined();
    createdTagId = data.id;
  });

  it("should list all tags and find the created one", async () => {
    const response = await handlers.getTags();
    expect(response.status).toBe(HTTP_OK);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((t: any) => t.id === createdTagId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Tag");
  });

  it("should retrieve a tag by ID", async () => {
    if (!createdTagId) {
      throw new Error("No tag created");
    }

    const response = await handlers.getTagById({
      params: { id: createdTagId },
    } as any);
    expect(response.status).toBe(HTTP_OK);

    const data = await response.json();
    expect(data.id).toBe(createdTagId);
    expect(data.name).toBe("Test Tag");
  });

  it("should update a tag", async () => {
    if (!createdTagId) {
      throw new Error("No tag created");
    }

    const updateData = {
      name: "Updated Test Tag",
    };

    const response = await handlers.updateTag(
      createPutEvent(createdTagId, updateData)
    );
    const data = await response.json();

    if (response.status !== HTTP_OK) {
      console.error("Update failed:", data);
    }

    expect(response.status).toBe(HTTP_OK);
    expect(data.name).toBe(updateData.name);
  });

  it("should delete a tag", async () => {
    if (!createdTagId) {
      throw new Error("No tag created");
    }

    const response = await handlers.deleteTag(createDeleteEvent(createdTagId));
    expect(response.status).toBe(HTTP_NO_CONTENT);

    // Verify it's gone from list
    const listResponse = await handlers.getTags();
    const listData = await listResponse.json();
    const found = listData.find((t: any) => t.id === createdTagId);
    expect(found).toBeUndefined();
  });
});
