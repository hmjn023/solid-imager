import type { Page } from "@playwright/test";

export function readClipboardImage(page: Page) {
	return page.evaluate(async () => {
		const items = await navigator.clipboard.read();
		const item = items.find((item) => item.types.includes("image/png"));
		if (!item) return null;
		const image = await createImageBitmap(await item.getType("image/png"));
		try {
			const canvas = new OffscreenCanvas(1, 1);
			const drawingContext = canvas.getContext("2d");
			if (!drawingContext) throw new Error("Canvas 2D is unavailable");
			drawingContext.drawImage(image, 0, 0);
			return {
				width: image.width,
				height: image.height,
				pixel: Array.from(drawingContext.getImageData(0, 0, 1, 1).data),
			};
		} finally {
			image.close();
		}
	});
}
