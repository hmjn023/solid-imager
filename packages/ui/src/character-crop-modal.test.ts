import type { SafeMediaRegion } from "@solid-imager/core/domain/media-regions/schemas";
import { describe, expect, it, vi } from "vite-plus/test";
import { refreshCharacterRegions } from "./character-crop-modal-state";

const BASE_REGION: SafeMediaRegion = {
	id: "10000000-0000-4000-8000-000000000001",
	mediaId: "20000000-0000-4000-8000-000000000002",
	kind: "manual",
	x: 0,
	y: 0,
	width: 1,
	height: 1,
	sourceWidth: 100,
	sourceHeight: 100,
	sourceModifiedAt: new Date("2026-01-01T00:00:00.000Z"),
	sourceRevision: "a".repeat(64),
	regionRevision: "b".repeat(64),
	label: "manual",
	manualReason: null,
	detector: null,
	detectorModel: null,
	detectorVersion: null,
	score: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	stale: false,
};

describe("refreshCharacterRegions", () => {
	it("loads saved regions on modal open without starting detection", async () => {
		const detectRegions = vi.fn(async () => []);
		const loadRegions = vi.fn(async () => [BASE_REGION]);

		const result = await refreshCharacterRegions({
			mediaId: BASE_REGION.mediaId,
			runDetection: false,
			loadRegions,
			detectRegions,
		});

		expect(detectRegions).not.toHaveBeenCalled();
		expect(loadRegions).toHaveBeenCalledWith(BASE_REGION.mediaId);
		expect(result).toEqual({ detectionCount: null, regions: [BASE_REGION] });
	});

	it("reloads the full list after detection so manual regions remain visible", async () => {
		const detected = {
			...BASE_REGION,
			id: "30000000-0000-4000-8000-000000000003",
			kind: "person" as const,
			label: "person",
		};
		const detectRegions = vi.fn(async () => [detected]);
		const loadRegions = vi.fn(async () => [BASE_REGION, detected]);

		const result = await refreshCharacterRegions({
			mediaId: BASE_REGION.mediaId,
			runDetection: true,
			loadRegions,
			detectRegions,
		});

		expect(detectRegions).toHaveBeenCalledBefore(loadRegions);
		expect(result.detectionCount).toBe(1);
		expect(result.regions.map((region) => region.kind)).toEqual([
			"manual",
			"person",
		]);
	});
});
