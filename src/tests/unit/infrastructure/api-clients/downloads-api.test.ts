import { describe, expect, it, vi } from "vitest";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import { API_ENDPOINTS } from "~/infrastructure/api-clients/shared/endpoints";

// Mock the base-client
vi.mock("~/infrastructure/api-clients/shared/base-client", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "~/infrastructure/api-clients/shared/base-client";

describe("Downloads API Client", () => {
  it("should call apiRequest with correct parameters for startDownloadJobs", async () => {
    const mediaSourceId = "test-source-id";
    const items = [
      {
        imageUrl: "http://example.com/image.jpg",
        authorName: "test-author",
      },
    ];

    vi.mocked(apiRequest).mockResolvedValue({ success: true });

    await startDownloadJobs(mediaSourceId, items);

    expect(apiRequest).toHaveBeenCalledWith(
      API_ENDPOINTS.downloads,
      expect.anything(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaSourceId,
          items,
        }),
      }
    );
  });
});
