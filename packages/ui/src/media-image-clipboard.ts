import { t } from "@solid-imager/i18n";
import { useContext } from "solid-js";
import {
	MediaContentAccessContext,
	type MediaContentTarget,
} from "./media-content-access";
import { toast } from "./toast";

async function readClipboardPng(response: Response): Promise<Blob> {
	if (!response.ok) {
		throw new Error(
			t("mediaViewer.failedToFetchMediaValue", {
				value0: String(response.status),
			}),
		);
	}
	const blob = await response.blob();
	if (blob.type === "image/png") return blob;

	const url = URL.createObjectURL(blob);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		const canvas = document.createElement("canvas");
		canvas.width = image.naturalWidth;
		canvas.height = image.naturalHeight;
		const drawingContext = canvas.getContext("2d");
		if (!drawingContext) throw new Error(t("clipboardCopy.failedToCopy"));
		drawingContext.drawImage(image, 0, 0);
		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((png) => {
				if (png) resolve(png);
				else reject(new Error(t("clipboardCopy.failedToCopy")));
			}, "image/png");
		});
	} finally {
		URL.revokeObjectURL(url);
	}
}

export function useCopyMediaImage() {
	const { getUrl, fetchContent } = useContext(MediaContentAccessContext);

	return async ({ mediaSourceId, id }: MediaContentTarget) => {
		const clipboard = navigator.clipboard;
		if (!clipboard?.write || typeof ClipboardItem === "undefined") {
			toast.error(t("clipboardCopy.clipboardAPINotSupportedOrNotInASecure"));
			return;
		}

		try {
			// Start the write during the menu selection gesture, before the image arrives.
			const png = fetchContent(getUrl(mediaSourceId, id)).then(
				readClipboardPng,
			);
			const item = new ClipboardItem({ "image/png": png });
			await Promise.all([png, clipboard.write([item])]);
			toast.success(t("clipboardCopy.copiedToClipboard"));
		} catch {
			toast.error(t("clipboardCopy.failedToCopy"));
		}
	};
}
