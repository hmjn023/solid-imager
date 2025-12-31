import { describe, expect, it, vi } from "vitest";
import { ProjectService } from "~/application/services/project-service";
import {
  DELETE,
  GET,
  POST,
} from "~/routes/api/sources/[mediaSourceId]/[mediaId]/projects";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

// Mock the ProjectService
vi.mock("~/application/services/project-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking a PascalCase export
  ProjectService: {
    getProjectsForMedia: vi.fn(),
    addProjectToMedia: vi.fn(),
    removeProjectFromMedia: vi.fn(),
  },
}));

const mockParams = {
  mediaSourceId: "123e4567-e89b-42d3-a456-426614174000",
  mediaId: "123e4567-e89b-42d3-a456-426614174001",
};

describe("GET /api/sources/{mediaSourceId}/{mediaId}/projects", () => {
  it("should return an array of projects", async () => {
    (ProjectService.getProjectsForMedia as any).mockResolvedValue([]);

    const response = await GET({ params: mockParams } as any);
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toBeInstanceOf(Array);
  });

  it("should return 400 for invalid params", async () => {
    const response = await GET({ params: {} } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});

describe("POST /api/sources/{mediaSourceId}/{mediaId}/projects", () => {
  it("should add project to media", async () => {
    const mockProject = {
      id: "123e4567-e89b-42d3-a456-426614174002",
      name: "Test Project",
    };
    (ProjectService.addProjectToMedia as any).mockResolvedValue(mockProject);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        projectId: "123e4567-e89b-42d3-a456-426614174002",
      }),
    });

    const response = await POST({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_CREATED);
    const data = await response.json();
    expect(data).toEqual(mockProject);
  });

  it("should return 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});

describe("DELETE /api/sources/{mediaSourceId}/{mediaId}/projects", () => {
  it("should remove project from media", async () => {
    const mockProject = {
      id: "123e4567-e89b-42d3-a456-426614174002",
      name: "Test Project",
    };
    (ProjectService.removeProjectFromMedia as any).mockResolvedValue(
      mockProject
    );

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({
        projectId: "123e4567-e89b-42d3-a456-426614174002",
      }),
    });

    const response = await DELETE({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toEqual(mockProject);
  });

  it("should return 400 for invalid body", async () => {
    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({}),
    });

    const response = await DELETE({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_BAD_REQUEST);
  });
});
