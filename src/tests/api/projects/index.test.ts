import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "~/application/services/project-service";
import { GET, POST } from "~/routes/api/projects/index";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

// Mock the ProjectService
vi.mock("~/application/services/project-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking a PascalCase export
  ProjectService: {
    getAllProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

describe("GET /api/projects", () => {
  it("should return an array of projects", async () => {
    // Mock return value
    (ProjectService.getAllProjects as any).mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toBeInstanceOf(Array);
  });
});

describe("POST /api/projects", () => {
  it("should create and return new project", async () => {
    const newData = {
      name: "Test Project",
      description: "Test description",
    };

    const mockCreatedProject = {
      id: 1,
      ...newData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock return value
    (ProjectService.createProject as any).mockResolvedValue(mockCreatedProject);

    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify(newData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(HTTP_CREATED);

    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.name).toBe(newData.name);
    expect(data.id).toBeDefined();
  });

  it("should return 400 for invalid data", async () => {
    const invalidData = {
      // Missing name
      description: "Invalid project",
    };

    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});
