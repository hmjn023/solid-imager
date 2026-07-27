import { tmpdir } from "node:os";
import path from "node:path";
import type {
	IMediaRegionRenderer,
	RenderedMediaRegion,
} from "@solid-imager/application/ports/media-region-service";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaRegion,
	MediaRegionRenderProfile,
} from "@solid-imager/core/domain/media-regions/schemas";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import sharp from "sharp";

function resolveSafePath(basePath: string, targetPath: string): string {
	const absoluteBase = path.resolve(basePath);
	const resolved = path.resolve(absoluteBase, targetPath);
	if (
		resolved !== absoluteBase &&
		!resolved.startsWith(`${absoluteBase}${path.sep}`)
	) {
		throw new Error("Media path escapes its configured source.");
	}
	return resolved;
}

function getExtraction(media: Media, region: MediaRegion) {
	if (
		region.x === null ||
		region.y === null ||
		region.width === null ||
		region.height === null
	) {
		throw new Error("Region does not contain crop bounds.");
	}
	const left = Math.max(0, Math.floor(region.x * media.width));
	const top = Math.max(0, Math.floor(region.y * media.height));
	const right = Math.min(
		media.width,
		Math.ceil((region.x + region.width) * media.width),
	);
	const bottom = Math.min(
		media.height,
		Math.ceil((region.y + region.height) * media.height),
	);
	return {
		left,
		top,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

export class SharpMediaRegionRenderer implements IMediaRegionRenderer {
	readonly version = "sharp-webp-isnetis-v1";

	constructor(private readonly sourceRepository: SourceRepository) {}

	async render(
		media: Media,
		region: MediaRegion,
		profile: MediaRegionRenderProfile,
	): Promise<RenderedMediaRegion> {
		const source = await this.sourceRepository.findById(media.mediaSourceId);
		if (source?.type !== "local") {
			throw new Error("Only local media sources support region rendering.");
		}
		const connection = localConnectionSchema.parse(source.connectionInfo);
		const sourcePath = resolveSafePath(connection.path, media.filePath);
		const extraction = getExtraction(media, region);

		if (!profile.transparent) {
			const bytes = await sharp(sourcePath)
				.extract(extraction)
				.webp()
				.toBuffer();
			return {
				bytes,
				format: "webp",
				width: extraction.width,
				height: extraction.height,
			};
		}

		const temporaryPath = path.join(
			tmpdir(),
			`solid-imager-region-${crypto.randomUUID()}.png`,
		);
		await sharp(sourcePath).extract(extraction).png().toFile(temporaryPath);
		try {
			const { segmentRgbaWithIsnetis } = await import("dghs-imgutils-rs");
			const bytes = new Uint8Array(await segmentRgbaWithIsnetis(temporaryPath));
			return {
				bytes,
				format: "png",
				width: extraction.width,
				height: extraction.height,
			};
		} finally {
			await Bun.file(temporaryPath)
				.delete()
				.catch(() => undefined);
		}
	}
}
