import { orpc } from "~/infrastructure/api-clients/orpc-client";

export function startThumbnailWarmup(input: {
	mediaSourceId: string;
	missingOnly: true;
	size: 256;
}) {
	return orpc.thumbnails.generate({
		sourceId: input.mediaSourceId,
		missingOnly: input.missingOnly,
		size: input.size,
	});
}
