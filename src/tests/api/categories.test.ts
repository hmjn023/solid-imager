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
  getCategories: (event?: any) => Promise<Response>;
  createCategory: (event: any) => Promise<Response>;
  getCategoryById: (event: any) => Promise<Response>;
  updateCategory: (event: any) => Promise<Response>;
  deleteCategory: (event: any) => Promise<Response>;
};

// Mock APIEvent-like objects
const createPostEvent = (body: any) => ({
  request: new Request("http://localhost/api/categories", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: {},
  nativeEvent: {} as any,
});

const createPutEvent = (id: string, body: any) => ({
  request: new Request(`http://localhost/api/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }),
  params: { id },
  nativeEvent: {} as any,
});

const createDeleteEvent = (id: string) => ({
  request: new Request(`http://localhost/api/categories/${id}`, {
    method: "DELETE",
  }),
  params: { id },
  nativeEvent: {} as any,
});

describe("Category API (Direct Handler)", () => {
  let handlers: ApiHandlers;
  let createdCategoryId: string;

  beforeAll(async () => {
    // Dynamic import to ensure mock is applied first
    const categoryIndex = await import("~/routes/api/categories/index");
    const categoryIdIndex = await import("~/routes/api/categories/[id]");

    handlers = {
      getCategories: categoryIndex.GET,
      createCategory: categoryIndex.POST,
      getCategoryById: categoryIdIndex.GET,
      updateCategory: categoryIdIndex.PUT,
      deleteCategory: categoryIdIndex.DELETE,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new category", async () => {
    const newCategory = {
      name: "Test Category",
      description: "Test Description",
      color: "#FF0000",
    };

    const response = await handlers.createCategory(
      createPostEvent(newCategory)
    );
    const data = await response.json();

    if (response.status !== HTTP_CREATED) {
      console.error("Create failed:", data);
    }

    expect(response.status).toBe(HTTP_CREATED);
    expect(data.name).toBe(newCategory.name);
    expect(data.id).toBeDefined();
    createdCategoryId = data.id;
  });

  it("should list all categories and find the created one", async () => {
    const response = await handlers.getCategories();
    expect(response.status).toBe(HTTP_OK);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    const found = data.find((c: any) => c.id === createdCategoryId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Test Category");
  });

  it("should retrieve a category by ID", async () => {
    if (!createdCategoryId) {
      throw new Error("No category created");
    }

    const response = await handlers.getCategoryById({
      params: { id: createdCategoryId },
    } as any);
    expect(response.status).toBe(HTTP_OK);

    const data = await response.json();
    expect(data.id).toBe(createdCategoryId);
    expect(data.name).toBe("Test Category");
  });

  it("should update a category", async () => {
    if (!createdCategoryId) {
      throw new Error("No category created");
    }

    const updateData = {
      name: "Updated Test Category",
    };

    const response = await handlers.updateCategory(
      createPutEvent(createdCategoryId, updateData)
    );
    const data = await response.json();

    if (response.status !== HTTP_OK) {
      console.error("Update failed:", data);
    }

    expect(response.status).toBe(HTTP_OK);
    expect(data.name).toBe(updateData.name);
  });

  it("should delete a category", async () => {
    if (!createdCategoryId) {
      throw new Error("No category created");
    }

    const response = await handlers.deleteCategory(
      createDeleteEvent(createdCategoryId)
    );
    expect(response.status).toBe(HTTP_NO_CONTENT);

    // Verify it's gone from list
    const listResponse = await handlers.getCategories();
    const listData = await listResponse.json();
    const found = listData.find((c: any) => c.id === createdCategoryId);
    expect(found).toBeUndefined();
  });
});
