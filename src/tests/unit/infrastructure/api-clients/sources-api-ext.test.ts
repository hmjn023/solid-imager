import { describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "~/infrastructure/api-clients/shared/endpoints";
import {
  fetchSourceDump,
  restoreSource,
} from "~/infrastructure/api-clients/sources-api";

// Mock the base-client
vi.mock("~/infrastructure/api-clients/shared/base-client", () => ({
  apiRequest: vi.fn(),
  apiBlobRequest: vi.fn(),
}));

import {
  apiBlobRequest,
  apiRequest,
} from "~/infrastructure/api-clients/shared/base-client";

describe("Sources API Client Extensions", () => {
  it("should call apiBlobRequest with correct parameters for fetchSourceDump", async () => {
    const id = "test-source-id";
    const mockBlob = new Blob(["dump content"]);

    vi.mocked(apiBlobRequest).mockResolvedValue(mockBlob);

    const result = await fetchSourceDump(id);

    expect(apiBlobRequest).toHaveBeenCalledWith(API_ENDPOINTS.sourceDump(id), {
      method: "GET",
    });
    expect(result).toBe(mockBlob);
  });

  it("should call apiRequest with correct parameters for restoreSource", async () => {
    const id = "test-source-id";
    const data = { items: [] };
    const mockResponse = { processed: 10, skipped: 2 };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await restoreSource(id, data);

    expect(apiRequest).toHaveBeenCalledWith(
      API_ENDPOINTS.sourceRestore(id),
      expect.anything(), // zod schema
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    expect(result).toEqual(mockResponse);
  });
});
