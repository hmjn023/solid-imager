import { describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "~/infrastructure/api-clients/shared/endpoints";
import {
  fetchSourceDump,
  restoreSource,
} from "~/infrastructure/api-clients/sources-api";

// Mock the base-client (still needed for dump)
vi.mock("~/infrastructure/api-clients/shared/base-client", () => ({
  apiRequest: vi.fn(),
  apiBlobRequest: vi.fn(),
}));

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
  orpc: {
    sources: {
      restore: vi.fn(),
    },
  },
}));

import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { apiBlobRequest } from "~/infrastructure/api-clients/shared/base-client";

describe("Sources API Client Extensions", () => {
  it("should call apiBlobRequest with correct parameters for fetchSourceDump", async () => {
    const id = "test-source-id";
    const mockBlob = new Blob(["dump content"]);

    (apiBlobRequest as any).mockResolvedValue(mockBlob);

    // Test default mode
    const result = await fetchSourceDump(id);

    expect(apiBlobRequest).toHaveBeenCalledWith(
      `${API_ENDPOINTS.sourceDump(id)}?mode=json`,
      {
        method: "GET",
      }
    );
    expect(result).toBe(mockBlob);

    // Test zip mode
    await fetchSourceDump(id, "zip");
    expect(apiBlobRequest).toHaveBeenCalledWith(
      `${API_ENDPOINTS.sourceDump(id)}?mode=zip`,
      {
        method: "GET",
      }
    );
  });

  it("should call orpc.sources.restore with correct parameters", async () => {
    const id = "test-source-id";
    const data = { items: [] };
    const mockResponse = { processed: 10, skipped: 2 };

    ((orpc.sources as any).restore as any).mockResolvedValue(
      mockResponse as any
    );

    const result = await restoreSource(id, data);

    expect((orpc.sources as any).restore).toHaveBeenCalledWith({
      id,
      data,
    });
    expect(result).toEqual(mockResponse);
  });
});
