import { describe, expect, it, vi } from "vite-plus/test";

describe("DiffDetectorServiceImpl", () => {
	it("loads all local media pages before diffing", async () => {
		const mediaRepository = {
			findAllBySourceId: vi
				.fn()
				.mockResolvedValueOnce(
					Array.from({ length: 100 }, (_, index) => ({
						id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
						filePath: `page-1/${index}.png`,
						modifiedAt: new Date("2026-01-01T00:00:00.000Z"),
						fileSize: 1,
					})),
				)
				.mockResolvedValueOnce([
					{
						id: "20000000-0000-4000-8000-000000000000",
						filePath: "page-2/final.png",
						modifiedAt: new Date("2026-01-01T00:00:00.000Z"),
						fileSize: 1,
					},
				]),
			getMd5HashesBySourceId: vi.fn().mockResolvedValue(new Map()),
		};

		const sourceRepository = {};

		const { DiffDetectorServiceImpl } = await import(
			"~/application/services/diff-detector-service"
		);
		const service = new DiffDetectorServiceImpl(
			mediaRepository as any,
			sourceRepository as any,
		);

		const result = await service.detectDiffs(
			"33333333-3333-4333-8333-333333333333",
			[],
		);

		expect(mediaRepository.findAllBySourceId).toHaveBeenNthCalledWith(
			1,
			"33333333-3333-4333-8333-333333333333",
			100,
			0,
		);
		expect(mediaRepository.findAllBySourceId).toHaveBeenNthCalledWith(
			2,
			"33333333-3333-4333-8333-333333333333",
			100,
			100,
		);
		expect(result.localOnly).toHaveLength(101);
	});
});
