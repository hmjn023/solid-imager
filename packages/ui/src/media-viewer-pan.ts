export type MediaPan = { x: number; y: number };

type MediaSize = { width: number; height: number };

/** Keep the fitted image covering the viewport wherever its zoomed size permits. */
export function clampMediaPan(
	pan: MediaPan,
	zoom: number,
	viewport: MediaSize,
	image?: MediaSize,
): MediaPan {
	const fit =
		image && image.width > 0 && image.height > 0
			? Math.min(viewport.width / image.width, viewport.height / image.height)
			: undefined;
	const width = fit !== undefined && image ? image.width * fit : viewport.width;
	const height =
		fit !== undefined && image ? image.height * fit : viewport.height;
	const maxX = Math.max(0, (width * zoom - viewport.width) / 2);
	const maxY = Math.max(0, (height * zoom - viewport.height) / 2);
	return {
		x: maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, pan.x)),
		y: maxY === 0 ? 0 : Math.max(-maxY, Math.min(maxY, pan.y)),
	};
}
