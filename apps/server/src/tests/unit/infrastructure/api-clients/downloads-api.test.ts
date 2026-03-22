import { describe, expect, it, vi } from "vite-plus/test";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
	orpc: {
		downloads: {
			start: vi.fn(),
		},
	},
}));

import { orpc } from "~/infrastructure/api-clients/orpc-client";

describe("Downloads API Client", () => {
	it("should call orpc.downloads.start with correct parameters", async () => {
		const mediaSourceId = "test-source-id";
		const items = [
			{
				imageUrl: "http://example.com/image.jpg",
				authorName: "test-author",
			},
		];

		(orpc.downloads.start as any).mockResolvedValue({ success: true } as any);

		await startDownloadJobs(mediaSourceId, items as any);

		expect(orpc.downloads.start).toHaveBeenCalledWith({
			mediaSourceId,
			items,
		});
	});
});
