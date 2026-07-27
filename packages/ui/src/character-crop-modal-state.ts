import type { SafeMediaRegion } from "@solid-imager/core/domain/media-regions/schemas";

export async function refreshCharacterRegions(options: {
	mediaId: string;
	runDetection: boolean;
	loadRegions: (mediaId: string) => Promise<SafeMediaRegion[]>;
	detectRegions: (mediaId: string) => Promise<SafeMediaRegion[]>;
}): Promise<{ detectionCount: number | null; regions: SafeMediaRegion[] }> {
	const detected = options.runDetection
		? await options.detectRegions(options.mediaId)
		: null;
	return {
		detectionCount: detected?.length ?? null,
		regions: await options.loadRegions(options.mediaId),
	};
}
