/**
 * Only creates an item-local selection callback when the collection actually
 * supports preview selection. Keeping the absent case as `undefined` prevents
 * links without preview support from mistaking a no-op callback for an
 * inspector interaction.
 */
export function createMediaPreviewSelectHandler<T>(
	item: T,
	onPreviewSelect?: (item: T) => void,
): (() => void) | undefined {
	if (!onPreviewSelect) {
		return undefined;
	}

	return () => onPreviewSelect(item);
}
export const isPlainPrimaryClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

export const isModifiedSelectionClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.altKey &&
	(event.metaKey || event.ctrlKey || event.shiftKey);

export function isFineMediaPointer(event: MouseEvent): boolean {
	if ("pointerType" in event && event.pointerType) {
		return event.pointerType === "mouse" || event.pointerType === "pen";
	}
	return window.matchMedia("(pointer: fine)").matches;
}
