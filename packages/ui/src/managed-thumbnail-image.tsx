import { createMemo, onCleanup } from "solid-js";
import { createManagedThumbnailSource } from "./managed-thumbnail-source";
import { ThumbnailImage, type ThumbnailImageProps } from "./thumbnail-image";

/** Reuses the shared async image UI while releasing URLs on changes/unmount. */
export function ManagedThumbnailImage(
	props: Omit<ThumbnailImageProps, "source"> & {
		src: string | Promise<string>;
		releaseUrl?: (url: string) => void;
	},
) {
	const local = props,
		image = omit(props, "src", "releaseUrl");
	const source = createMemo(() => {
		const managed = createManagedThumbnailSource(local.src, local.releaseUrl);
		onCleanup(managed.dispose);
		return managed.source;
	});
	return <ThumbnailImage {...image} source={source()} />;
}

import { omit } from "solid-js";
