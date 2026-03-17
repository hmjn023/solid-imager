import { describe, expect, it, vi } from "vite-plus/test";
import { fetchAiTags } from "~/infrastructure/api-clients/ai-api";

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
  orpc: {
    ai: {
      tag: vi.fn(),
    },
  },
}));

import { orpc } from "~/infrastructure/api-clients/orpc-client";

describe("AI API Client", () => {
  it("should call orpc.ai.tag with correct parameters for fetchAiTags", async () => {
    const params = {
      mediaSourceId: "test-source-id",
      mediaId: "test-media-id",
    };

    const mockResponse = {
      general: { tag1: 0.9 },
      character: { char1: 0.8 },
      ips: ["ip1"],

      ips_mapping: { ip1: ["tag1"] },
    };

    (orpc.ai.tag as any).mockResolvedValue(mockResponse as any);

    const result = await fetchAiTags(params);

    expect(orpc.ai.tag).toHaveBeenCalledWith(params);
    expect(result).toEqual(mockResponse);
  });
});
