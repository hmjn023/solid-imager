import { describe, expect, it, vi } from "vitest";
import { IpService } from "~/application/services/ip-service";
import { GET, POST } from "~/routes/api/ips/index";

// Mock the IpService
vi.mock("~/application/services/ip-service", () => ({
  IpService: {
    getAllIps: vi.fn(),
    createIp: vi.fn(),
    deleteIp: vi.fn(),
  },
}));

describe("GET /api/ips", () => {
  it("should return an array of IPs", async () => {
    (IpService.getAllIps as any).mockResolvedValue([]);

    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toBeInstanceOf(Array);
  });
});

describe("POST /api/ips", () => {
  it("should create and return new IP", async () => {
    const newData = {
      name: "Test IP",
      description: "Test description",
    };

    const mockCreatedIp = {
      id: 1,
      ...newData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    (IpService.createIp as any).mockResolvedValue(mockCreatedIp);

    const request = new Request("http://localhost/api/ips", {
      method: "POST",
      body: JSON.stringify(newData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toBeDefined();
    expect(data.name).toBe(newData.name);
    expect(data.id).toBeDefined();
  });

  it("should return 400 for invalid data", async () => {
    const invalidData = {
      // Missing name
      description: "Invalid IP",
    };

    const request = new Request("http://localhost/api/ips", {
      method: "POST",
      body: JSON.stringify(invalidData),
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);
  });
});
