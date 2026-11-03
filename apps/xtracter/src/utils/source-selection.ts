/** Minimal source information needed to resolve an extension selection. */
export interface SelectableSource {
	id: string;
	name: string;
}

/**
 * Selects by preferred ID, then fallback name, then first source.
 *
 * @param sources - Available sources in fallback priority order.
 * @param preferredId - Preferred source ID, if one has been saved.
 * @param fallbackName - Name to match when the preferred ID is absent or no longer exists.
 * @returns The selected source, or null if the list is empty.
 */
export function resolveEffectiveSourceId(
	sources: readonly SelectableSource[],
	preferredId?: string | null,
	fallbackName?: string,
): SelectableSource | null {
	if (sources.length === 0) {
		return null;
	}

	if (preferredId) {
		const preferred = sources.find((source) => source.id === preferredId);
		if (preferred) {
			return preferred;
		}
	}

	if (fallbackName) {
		const fallback = sources.find((source) => source.name === fallbackName);
		if (fallback) {
			return fallback;
		}
	}

	return sources[0] ?? null;
}
