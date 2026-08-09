/**
 * Only creates an item-local selection callback when the collection actually
 * supports preview selection. Keeping the absent case as `undefined` prevents
 * legacy links from mistaking a no-op callback for an inspector interaction.
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
