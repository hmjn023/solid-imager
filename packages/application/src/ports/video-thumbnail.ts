import type { Media } from "@solid-imager/core/media";

/** Returns a current, readable still image for video inference, generating it if needed. */
export type ResolveVideoThumbnail = (
	media: Pick<Media, "id" | "mediaSourceId" | "modifiedAt">,
) => Promise<string>;
