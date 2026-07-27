import type { IMediaStorage } from "@solid-imager/core";
import {
	MediaRegionRevisionConflictError,
	ResourceNotFoundError,
	StaleMediaRegionError,
} from "@solid-imager/core/domain/errors";
import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	createMediaRegionRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { MediaRegion } from "@solid-imager/core/domain/media-regions/schemas";
import type { IMediaRegionRepository } from "@solid-imager/core/domain/repositories/media-region-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { describe, expect, it, vi } from "vitest";
import type { IMediaRegionRenderer } from "../ports/media-region-service";
import {
	computeMediaSourceRevision,
	MediaRegionService,
} from "./media-region-service";

const MEDIA: Media = {
	id: "10000000-0000-4000-8000-000000000001",
	mediaSourceId: "20000000-0000-4000-8000-000000000002",
	filePath: "images/source.png",
	fileName: "source.png",
	mediaType: "image",
	width: 100,
	height: 200,
	fileSize: 1234,
	description: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	modifiedAt: new Date("2026-01-02T00:00:00.000Z"),
	indexedAt: new Date("2026-01-03T00:00:00.000Z"),
	status: "active",
};

async function makeRegion(
	kind: "full" | "person" | "manual" = "person",
	sourceRevisionOverride?: string,
): Promise<MediaRegion> {
	const sourceRevision =
		sourceRevisionOverride ?? (await computeMediaSourceRevision(MEDIA));
	const bbox =
		kind === "full" ? null : { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
	const regionRevision = await createMediaRegionRevision({
		sourceRevision,
		kind,
		x: bbox?.x ?? null,
		y: bbox?.y ?? null,
		width: bbox?.width ?? null,
		height: bbox?.height ?? null,
		label: kind === "person" ? "person" : null,
		detector: kind === "person" ? "detector" : null,
		detectorModel: kind === "person" ? "model" : null,
		detectorVersion: kind === "person" ? "1" : null,
		manualReason: null,
	});
	return {
		id: "30000000-0000-4000-8000-000000000003",
		mediaId: MEDIA.id,
		kind,
		x: bbox?.x ?? null,
		y: bbox?.y ?? null,
		width: bbox?.width ?? null,
		height: bbox?.height ?? null,
		sourceWidth: MEDIA.width,
		sourceHeight: MEDIA.height,
		sourceModifiedAt: MEDIA.modifiedAt,
		sourceRevision,
		regionRevision,
		label: kind === "person" ? "person" : null,
		manualReason: null,
		detectionKey: kind === "person" ? "detection-key" : null,
		detector: kind === "person" ? "detector" : null,
		detectorModel: kind === "person" ? "model" : null,
		detectorVersion: kind === "person" ? "1" : null,
		score: kind === "person" ? 0.9 : null,
		createdAt: new Date("2026-01-04T00:00:00.000Z"),
		updatedAt: new Date("2026-01-04T00:00:00.000Z"),
	};
}

function setup(region: MediaRegion, rendererVersion = "renderer-v1") {
	const regionRepository: IMediaRegionRepository = {
		findByMediaId: vi.fn(async () => [region]),
		findById: vi.fn(async () => region),
		create: vi.fn(async () => region),
		upsertDetected: vi.fn(async () => region),
		deleteDetectedNotIn: vi.fn(async () => undefined),
		update: vi.fn(async (_id, _expectedRevision, data) => ({
			...region,
			kind: data.kind ?? region.kind,
			x: data.bbox?.x ?? region.x,
			y: data.bbox?.y ?? region.y,
			width: data.bbox?.width ?? region.width,
			height: data.bbox?.height ?? region.height,
			label: data.label === undefined ? region.label : data.label,
			manualReason:
				data.manualReason === undefined
					? region.manualReason
					: data.manualReason,
			detectionKey:
				data.detectionKey === undefined
					? region.detectionKey
					: data.detectionKey,
			regionRevision: data.regionRevision,
			updatedAt: data.updatedAt,
		})),
		delete: vi.fn(async () => true),
		findMaterializedByDerivationKey: vi.fn(async () => null),
		createMaterialized: vi.fn(async () => MEDIA),
	};
	const renderer: IMediaRegionRenderer = {
		version: rendererVersion,
		render: vi.fn(async () => ({
			bytes: new Uint8Array([1, 2, 3]),
			format: "webp" as const,
			width: 30,
			height: 80,
		})),
	};
	const transactionManager: TransactionManager = {
		transaction: async (callback) => callback(undefined),
	};
	const mediaRepository = {
		findById: vi.fn(async () => MEDIA),
	} as Partial<IMediaRepository> as IMediaRepository;
	const sourceRepository = {
		findAll: vi.fn(async () => []),
		findById: vi.fn(async () => null),
		create: vi.fn(async () => {
			throw new Error("Not used in this test.");
		}),
		update: vi.fn(async () => {
			throw new Error("Not used in this test.");
		}),
		delete: vi.fn(async () => undefined),
	} as SourceRepository;
	const mediaStorage = {} as IMediaStorage;
	const service = new MediaRegionService({
		regionRepository,
		mediaRepository,
		sourceRepository,
		transactionManager,
		mediaStorage,
		renderer,
	});
	return { regionRepository, renderer, service };
}

describe("MediaRegionService", () => {
	it("uses the shared canonical source revision helper", async () => {
		await expect(computeMediaSourceRevision(MEDIA)).resolves.toBe(
			await createMediaSourceRevision({
				mediaId: MEDIA.id,
				mediaSourceId: MEDIA.mediaSourceId,
				modifiedAt: MEDIA.modifiedAt,
				fileSize: MEDIA.fileSize,
				width: MEDIA.width,
				height: MEDIA.height,
			}),
		);
	});

	it("keeps full regions out of every public operation", async () => {
		const full = await makeRegion("full");
		const { regionRepository, renderer, service } = setup(full);

		await expect(service.list(MEDIA.id)).resolves.toEqual([]);
		await expect(
			service.update({
				regionId: full.id,
				expectedRevision: full.regionRevision,
				label: "forbidden",
			}),
		).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(
			service.delete(full.id, full.regionRevision),
		).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(
			service.render(full.id, full.regionRevision, { transparent: false }),
		).rejects.toBeInstanceOf(ResourceNotFoundError);
		await expect(
			service.materialize(full.id, full.regionRevision, { transparent: false }),
		).rejects.toBeInstanceOf(ResourceNotFoundError);
		expect(regionRepository.delete).not.toHaveBeenCalled();
		expect(renderer.render).not.toHaveBeenCalled();
	});

	it("turns an edited detected region into a manual region", async () => {
		const detected = await makeRegion("person");
		const { regionRepository, service } = setup(detected);
		const updated = await service.update({
			regionId: detected.id,
			expectedRevision: detected.regionRevision,
			bbox: { x: 0.2, y: 0.2, width: 0.2, height: 0.2 },
		});

		expect(updated.kind).toBe("manual");
		expect(regionRepository.update).toHaveBeenCalledWith(
			detected.id,
			detected.regionRevision,
			expect.objectContaining({ kind: "manual", detectionKey: null }),
		);
	});

	it("rejects stale regions before rendering", async () => {
		const staleRevision = "a".repeat(64);
		const stale = await makeRegion("person", staleRevision);
		const { renderer, service } = setup(stale);

		await expect(
			service.render(stale.id, stale.regionRevision, { transparent: false }),
		).rejects.toBeInstanceOf(StaleMediaRegionError);
		await expect(
			service.materialize(stale.id, stale.regionRevision, {
				transparent: false,
			}),
		).rejects.toBeInstanceOf(StaleMediaRegionError);
		expect(renderer.render).not.toHaveBeenCalled();
	});

	it("rejects an outdated optimistic revision", async () => {
		const region = await makeRegion("person");
		const { service } = setup(region);
		await expect(
			service.render(region.id, "b".repeat(64), { transparent: false }),
		).rejects.toBeInstanceOf(MediaRegionRevisionConflictError);
	});

	it("changes the ETag when the renderer implementation version changes", async () => {
		const region = await makeRegion("person");
		const first = setup(region, "renderer-v1");
		const second = setup(region, "renderer-v2");
		const firstIdentity = await first.service.getRenderIdentity(
			region.id,
			region.regionRevision,
			{ transparent: false },
		);
		const secondIdentity = await second.service.getRenderIdentity(
			region.id,
			region.regionRevision,
			{ transparent: false },
		);

		expect(firstIdentity.etag).not.toBe(secondIdentity.etag);
		expect(firstIdentity.etag).toMatch(/^"[0-9a-f]{64}"$/);
		expect(first.renderer.render).not.toHaveBeenCalled();
		expect(second.renderer.render).not.toHaveBeenCalled();
	});
});
