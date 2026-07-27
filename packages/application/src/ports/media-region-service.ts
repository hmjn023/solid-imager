import type { Media } from "@solid-imager/core/domain/media/schemas";
import type {
	MediaRegion,
	MediaRegionRenderProfile,
} from "@solid-imager/core/domain/media-regions/schemas";

export type RenderedMediaRegion = {
	bytes: Uint8Array;
	format: "webp" | "png";
	width: number;
	height: number;
};

export interface IMediaRegionRenderer {
	readonly version: string;
	render(
		media: Media,
		region: MediaRegion,
		profile: MediaRegionRenderProfile,
	): Promise<RenderedMediaRegion>;
}
