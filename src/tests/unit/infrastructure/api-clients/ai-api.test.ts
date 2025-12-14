import { describe, expect, it, vi } from "vitest";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";
import { API_ENDPOINTS } from "~/infrastructure/api-clients/shared/endpoints";

// Mock the base-client
vi.mock("~/infrastructure/api-clients/shared/base-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "~/infrastructure/api-clients/shared/base-client";

describe("AI API Client", () => {
  it("should call apiRequest with correct parameters for fetchAiTags", async () => {
    const params = {
      mediaSourceId: "test-source-id",
      mediaId: "test-media-id",
    };

    const mockResponse = {
      general: { tag1: 0.9 },
      character: { char1: 0.8 },
      ips: ["ip1"],
      // biome-ignore lint/style/useNamingConvention: mock data
      ips_mapping: { ip1: ["tag1"] },
    };

    vi.mocked(apiRequest).mockResolvedValue(mockResponse);

    const result = await fetchAiTags(params);

    expect(apiRequest).toHaveBeenCalledWith(
      API_ENDPOINTS.aiTag,
      expect.anything(), // zod schema
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      }
    );
    expect(result).toEqual(mockResponse);
  });
});
