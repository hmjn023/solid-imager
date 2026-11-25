import { mediaContentPath } from "@solid-imager/core/http";
import type { Media } from "@solid-imager/core/media";
import { createContext, useContext } from "solid-js";

export type MediaContentTarget = Pick<Media, "id" | "mediaSourceId">;

export const MediaContentAccessContext = createContext({
	getUrl: mediaContentPath,
	fetchContent: (url: string) => fetch(url),
});

export function useOpenOriginalMedia() {
	const { getUrl } = useContext(MediaContentAccessContext);
	return ({ mediaSourceId, id }: MediaContentTarget) => {
		window.open(getUrl(mediaSourceId, id), "_blank", "noopener,noreferrer");
	};
}
