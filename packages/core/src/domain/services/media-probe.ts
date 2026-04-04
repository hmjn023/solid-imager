import type { MediaMetadata } from "../../interfaces/media-storage";

export type MediaProbeResult = MediaMetadata & {
	duration?: number;
	mimeType?: string | null;
	codec?: string | null;
};

export type IMediaProbe = {
	probe(mediaPath: string): Promise<MediaProbeResult>;
	getDimensions(mediaPath: string): Promise<{ width: number; height: number }>;
};
