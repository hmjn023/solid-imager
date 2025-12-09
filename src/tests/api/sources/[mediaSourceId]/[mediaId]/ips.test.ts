import { describe, expect, it, vi } from "vitest";
import { IpService } from "~/application/services/ip-service";
import {
  DELETE,
  GET,
  POST,
} from "~/routes/api/sources/[mediaSourceId]/[mediaId]/ips";

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

// Mock the IpService
vi.mock("~/application/services/ip-service", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking a PascalCase export
  IpService: {
    getIpsForMedia: vi.fn(),
    addIpToMedia: vi.fn(),
    removeIpFromMedia: vi.fn(),
  },
}));

const mockParams = {
  mediaSourceId: "123e4567-e89b-42d3-a456-426614174000",
  mediaId: "123e4567-e89b-42d3-a456-426614174001",
};

describe("GET /api/sources/{mediaSourceId}/{mediaId}/ips", () => {
  it("should return an array of IPs", async () => {
    (IpService.getIpsForMedia as any).mockResolvedValue([]);

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

describe("POST /api/sources/{mediaSourceId}/{mediaId}/ips", () => {
  it("should add IP to media", async () => {
    const mockIp = { id: 1, name: "Test IP" };
    (IpService.addIpToMedia as any).mockResolvedValue(mockIp);

    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ipId: 1 }),
    });

    const response = await POST({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_CREATED);
    const data = await response.json();
    expect(data).toEqual(mockIp);
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

describe("DELETE /api/sources/{mediaSourceId}/{mediaId}/ips", () => {
  it("should remove IP from media", async () => {
    const mockIp = { id: 1, name: "Test IP" };
    (IpService.removeIpFromMedia as any).mockResolvedValue(mockIp);

    const request = new Request("http://localhost", {
      method: "DELETE",
      body: JSON.stringify({ ipId: 1 }),
    });

    const response = await DELETE({ params: mockParams, request } as any);
    expect(response.status).toBe(HTTP_OK);
    const data = await response.json();
    expect(data).toEqual(mockIp);
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
