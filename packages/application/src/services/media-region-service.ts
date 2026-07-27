import type { IMediaStorage } from "@solid-imager/core";
import {
	MediaRegionRevisionConflictError,
	ResourceNotFoundError,
	StaleMediaRegionError,
	ValidationError,
} from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import {
	createMediaRegionRevision,
	createMediaSourceRevision,
} from "@solid-imager/core/domain/media/revision";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type {
	CreateManualMediaRegion,
	DetectedRegionInput,
	MaterializedMediaRegion,
	MediaRegion,
	MediaRegionBoundingBox,
	MediaRegionRenderProfile,
	SafeMediaRegion,
	UpdateMediaRegion,
} from "@solid-imager/core/domain/media-regions/schemas";
import type {
	IMediaRegionRepository,
	NewMediaRegion,
} from "@solid-imager/core/domain/repositories/media-region-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { IMediaRegionRenderer } from "../ports/media-region-service";

const DETECTOR_NAME = "dghs-imgutils-rs";
const DETECTOR_MODEL = "person-detection";
const DETECTOR_VERSION = "1";
const RENDER_PROFILE_VERSION = "crop-v1";

type MediaRegionServiceDependencies = {
	regionRepository: IMediaRegionRepository;
	mediaRepository: IMediaRepository;
	sourceRepository: SourceRepository;
	transactionManager: TransactionManager;
	mediaStorage: IMediaStorage;
	renderer: IMediaRegionRenderer;
};

export type PersistedDetectionOptions = {
	mediaId: string;
	detections: DetectedRegionInput[];
	detector?: string;
	detectorModel?: string;
	detectorVersion?: string;
};

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

async function sha256(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return bytesToHex(new Uint8Array(digest));
}

/** Canonical revision shared by detection, render and stale checks. */
export function computeMediaSourceRevision(media: Media): Promise<string> {
	return createMediaSourceRevision({
		mediaId: media.id,
		mediaSourceId: media.mediaSourceId,
		modifiedAt: media.modifiedAt,
		fileSize: media.fileSize,
		width: media.width,
		height: media.height,
	});
}

function toSafeMediaRegion(
	region: MediaRegion,
	currentSourceRevision: string,
): SafeMediaRegion {
	const { detectionKey: omittedDetectionKey, ...safe } = region;
	void omittedDetectionKey;
	return {
		...safe,
		stale: region.sourceRevision !== currentSourceRevision,
	};
}

function getBoundingBox(region: MediaRegion): MediaRegionBoundingBox {
	if (
		region.x === null ||
		region.y === null ||
		region.width === null ||
		region.height === null
	) {
		throw new ValidationError(`Media region ${region.id} has no crop bounds.`);
	}
	return {
		x: region.x,
		y: region.y,
		width: region.width,
		height: region.height,
	};
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function normalizeDetection(
	detection: DetectedRegionInput,
	media: Media,
): {
	bbox: MediaRegionBoundingBox;
	integerBox: [number, number, number, number];
} | null {
	const x1 = Math.round(clamp(detection.bbox.x1, 0, media.width));
	const y1 = Math.round(clamp(detection.bbox.y1, 0, media.height));
	const x2 = Math.round(clamp(detection.bbox.x2, 0, media.width));
	const y2 = Math.round(clamp(detection.bbox.y2, 0, media.height));
	if (x2 <= x1 || y2 <= y1) {
		return null;
	}
	return {
		bbox: {
			x: x1 / media.width,
			y: y1 / media.height,
			width: (x2 - x1) / media.width,
			height: (y2 - y1) / media.height,
		},
		integerBox: [x1, y1, x2, y2],
	};
}

function splitFileName(fileName: string): { base: string; extension: string } {
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0) {
		return { base: fileName, extension: "" };
	}
	return { base: fileName.slice(0, dot), extension: fileName.slice(dot + 1) };
}

function getDirectory(filePath: string): string {
	const slash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
	return slash < 0 ? "" : filePath.slice(0, slash + 1);
}

export class MediaRegionService {
	private readonly regionRepository: IMediaRegionRepository;
	private readonly mediaRepository: IMediaRepository;
	private readonly sourceRepository: SourceRepository;
	private readonly transactionManager: TransactionManager;
	private readonly mediaStorage: IMediaStorage;
	private readonly renderer: IMediaRegionRenderer;

	constructor(dependencies: MediaRegionServiceDependencies) {
		this.regionRepository = dependencies.regionRepository;
		this.mediaRepository = dependencies.mediaRepository;
		this.sourceRepository = dependencies.sourceRepository;
		this.transactionManager = dependencies.transactionManager;
		this.mediaStorage = dependencies.mediaStorage;
		this.renderer = dependencies.renderer;
	}

	async list(mediaId: string): Promise<SafeMediaRegion[]> {
		const media = await this.requireMedia(mediaId);
		const currentRevision = await computeMediaSourceRevision(media);
		const regions = await this.regionRepository.findByMediaId(mediaId);
		return regions
			.filter((region) => region.kind !== "full")
			.map((region) => toSafeMediaRegion(region, currentRevision));
	}

	async createManual(input: CreateManualMediaRegion): Promise<SafeMediaRegion> {
		const media = await this.requireImage(input.mediaId);
		const sourceRevision = await computeMediaSourceRevision(media);
		const label = input.label ?? null;
		const manualReason = input.manualReason ?? null;
		const regionRevision = await createMediaRegionRevision({
			sourceRevision,
			kind: "manual",
			x: input.bbox.x,
			y: input.bbox.y,
			width: input.bbox.width,
			height: input.bbox.height,
			label,
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			manualReason,
		});
		const region = await this.regionRepository.create({
			mediaId: media.id,
			kind: "manual",
			bbox: input.bbox,
			sourceWidth: media.width,
			sourceHeight: media.height,
			sourceModifiedAt: media.modifiedAt,
			sourceRevision,
			regionRevision,
			label,
			manualReason,
			detectionKey: null,
			detector: null,
			detectorModel: null,
			detectorVersion: null,
			score: null,
		});
		return toSafeMediaRegion(region, sourceRevision);
	}

	async update(input: UpdateMediaRegion): Promise<SafeMediaRegion> {
		const current = await this.requireRegion(input.regionId);
		const media = await this.requireImage(current.mediaId);
		const sourceRevision = await computeMediaSourceRevision(media);
		if (current.sourceRevision !== sourceRevision) {
			throw new StaleMediaRegionError(current.id);
		}
		const detectedRegionWasEdited =
			current.kind === "person" &&
			(input.bbox !== undefined ||
				input.label !== undefined ||
				input.manualReason !== undefined);
		const nextKind = detectedRegionWasEdited ? "manual" : current.kind;
		const currentBbox = getBoundingBox(current);
		const nextBbox = input.bbox ?? currentBbox;
		const nextLabel = input.label === undefined ? current.label : input.label;
		const nextManualReason =
			input.manualReason === undefined
				? current.manualReason
				: input.manualReason;
		const regionRevision = await createMediaRegionRevision({
			sourceRevision,
			kind: nextKind,
			x: nextBbox.x,
			y: nextBbox.y,
			width: nextBbox.width,
			height: nextBbox.height,
			label: nextLabel,
			detector: current.detector,
			detectorModel: current.detectorModel,
			detectorVersion: current.detectorVersion,
			manualReason: nextManualReason,
		});

		const updated = await this.regionRepository.update(
			current.id,
			input.expectedRevision,
			{
				bbox: input.bbox,
				kind: nextKind === current.kind ? undefined : nextKind,
				regionRevision,
				label: input.label,
				manualReason: input.manualReason,
				detectionKey: detectedRegionWasEdited ? null : undefined,
				updatedAt: new Date(),
			},
		);
		if (!updated) {
			throw new MediaRegionRevisionConflictError(current.id);
		}
		return toSafeMediaRegion(updated, sourceRevision);
	}

	async delete(regionId: string, expectedRevision: string): Promise<void> {
		await this.requireRegion(regionId);
		const deleted = await this.regionRepository.delete(
			regionId,
			expectedRevision,
		);
		if (!deleted) {
			const existing = await this.regionRepository.findById(regionId);
			if (!existing) {
				throw new ResourceNotFoundError("Media Region", regionId);
			}
			throw new MediaRegionRevisionConflictError(regionId);
		}
	}

	async persistDetections(
		options: PersistedDetectionOptions,
	): Promise<SafeMediaRegion[]> {
		const media = await this.requireImage(options.mediaId);
		const sourceRevision = await computeMediaSourceRevision(media);
		const detector = options.detector ?? DETECTOR_NAME;
		const detectorModel = options.detectorModel ?? DETECTOR_MODEL;
		const detectorVersion = options.detectorVersion ?? DETECTOR_VERSION;
		const pending: NewMediaRegion[] = [];

		for (const detection of options.detections) {
			const normalized = normalizeDetection(detection, media);
			if (!normalized) {
				continue;
			}
			const detectionKey = await sha256(
				JSON.stringify({
					mediaId: media.id,
					sourceRevision,
					detector,
					detectorModel,
					detectorVersion,
					label: detection.label,
					bbox: normalized.integerBox,
				}),
			);
			pending.push({
				mediaId: media.id,
				kind: "person",
				bbox: normalized.bbox,
				sourceWidth: media.width,
				sourceHeight: media.height,
				sourceModifiedAt: media.modifiedAt,
				sourceRevision,
				regionRevision: await createMediaRegionRevision({
					sourceRevision,
					kind: "person",
					x: normalized.bbox.x,
					y: normalized.bbox.y,
					width: normalized.bbox.width,
					height: normalized.bbox.height,
					label: detection.label,
					detector,
					detectorModel,
					detectorVersion,
					manualReason: null,
				}),
				label: detection.label,
				manualReason: null,
				detectionKey,
				detector,
				detectorModel,
				detectorVersion,
				score: detection.score,
			});
		}

		const regions = await this.transactionManager.transaction(
			async (tx: Transaction) => {
				const persisted: MediaRegion[] = [];
				for (const data of pending) {
					persisted.push(await this.regionRepository.upsertDetected(data, tx));
				}
				await this.regionRepository.deleteDetectedNotIn(
					media.id,
					pending.flatMap((region) =>
						region.detectionKey ? [region.detectionKey] : [],
					),
					tx,
				);
				return persisted;
			},
		);

		return regions.map((region) => toSafeMediaRegion(region, sourceRevision));
	}

	async render(
		regionId: string,
		expectedRevision: string,
		profile: MediaRegionRenderProfile,
	) {
		const { media, region } = await this.requireCurrentRegion(
			regionId,
			expectedRevision,
		);
		return this.renderer.render(media, region, profile);
	}

	async getRenderIdentity(
		regionId: string,
		expectedRevision: string,
		profile: MediaRegionRenderProfile,
	): Promise<{ etag: string }> {
		const { region } = await this.requireCurrentRegion(
			regionId,
			expectedRevision,
		);
		const digest = await sha256(
			JSON.stringify({
				regionId: region.id,
				regionRevision: region.regionRevision,
				sourceRevision: region.sourceRevision,
				profile,
				profileVersion: RENDER_PROFILE_VERSION,
				rendererVersion: this.renderer.version,
			}),
		);
		return { etag: `"${digest}"` };
	}

	async materialize(
		regionId: string,
		expectedRevision: string,
		profile: MediaRegionRenderProfile,
	): Promise<MaterializedMediaRegion> {
		const { media, region } = await this.requireCurrentRegion(
			regionId,
			expectedRevision,
		);
		const derivationKey = await sha256(
			JSON.stringify({
				regionId,
				regionRevision: region.regionRevision,
				sourceRevision: region.sourceRevision,
				profile,
				profileVersion: RENDER_PROFILE_VERSION,
				rendererVersion: this.renderer.version,
			}),
		);
		const existing =
			await this.regionRepository.findMaterializedByDerivationKey(
				derivationKey,
			);
		if (existing) {
			return {
				regionId,
				mediaId: existing.id,
				fileName: existing.fileName,
				alreadyExisted: true,
			};
		}

		const source = await this.sourceRepository.findById(media.mediaSourceId);
		if (source?.type !== "local") {
			throw new ValidationError(
				"Only local media sources support region materialization.",
			);
		}
		const connection = localConnectionSchema.parse(source.connectionInfo);
		const rendered = await this.renderer.render(media, region, profile);
		const originalName = splitFileName(media.fileName);
		const suffix = profile.transparent ? "transparent" : "crop";
		const outputFileName = `${originalName.base}.region-${region.id.slice(0, 8)}-${derivationKey.slice(0, 8)}-${suffix}.${rendered.format}`;
		const filePath = `${getDirectory(media.filePath)}${outputFileName}`;
		const saved = await this.mediaStorage.saveFile(
			connection.path,
			{
				name: outputFileName,
				arrayBuffer: async () => rendered.bytes,
			},
			{ filename: filePath, overwrite: true },
		);

		try {
			const materialized = await this.regionRepository.createMaterialized({
				media: {
					mediaSourceId: media.mediaSourceId,
					filePath: saved.filePath,
					fileName: outputFileName,
					mediaType: "image",
					width: saved.width,
					height: saved.height,
					fileSize: saved.size,
					description: `Materialized region from ${media.fileName}`,
					createdAt: saved.createdAt,
					modifiedAt: saved.modifiedAt,
				},
				parentMediaId: media.id,
				sourceRegionId: region.id,
				derivationKey,
				snapshot: {
					regionId: region.id,
					regionRevision: region.regionRevision,
					sourceRevision: region.sourceRevision,
					bbox: getBoundingBox(region),
					label: region.label,
					profile,
					profileVersion: RENDER_PROFILE_VERSION,
					rendererVersion: this.renderer.version,
				},
			});
			return {
				regionId,
				mediaId: materialized.id,
				fileName: outputFileName,
				alreadyExisted: false,
			};
		} catch (error) {
			const winner =
				await this.regionRepository.findMaterializedByDerivationKey(
					derivationKey,
				);
			if (winner) {
				return {
					regionId,
					mediaId: winner.id,
					fileName: winner.fileName,
					alreadyExisted: true,
				};
			}
			await this.mediaStorage
				.deleteFile(connection.path, saved.filePath)
				.catch(() => undefined);
			throw error;
		}
	}

	private async requireMedia(mediaId: string): Promise<Media> {
		const media = await this.mediaRepository.findById(mediaId);
		if (!media) {
			throw new ResourceNotFoundError("Media", mediaId);
		}
		return media;
	}

	private async requireImage(mediaId: string): Promise<Media> {
		const media = await this.requireMedia(mediaId);
		if (media.mediaType !== "image" || media.width <= 0 || media.height <= 0) {
			throw new ValidationError(
				"Media regions require an image with dimensions.",
			);
		}
		return media;
	}

	private async requireRegion(
		regionId: string,
	): Promise<MediaRegion & { kind: "person" | "manual" }> {
		const region = await this.regionRepository.findById(regionId);
		if (!region || region.kind === "full") {
			throw new ResourceNotFoundError("Media Region", regionId);
		}
		return { ...region, kind: region.kind };
	}

	private async requireCurrentRegion(
		regionId: string,
		expectedRevision: string,
	): Promise<{ media: Media; region: MediaRegion }> {
		const region = await this.requireRegion(regionId);
		if (region.regionRevision !== expectedRevision) {
			throw new MediaRegionRevisionConflictError(region.id);
		}
		const media = await this.requireImage(region.mediaId);
		const sourceRevision = await computeMediaSourceRevision(media);
		if (region.sourceRevision !== sourceRevision) {
			throw new StaleMediaRegionError(region.id);
		}
		getBoundingBox(region);
		return { media, region };
	}
}
