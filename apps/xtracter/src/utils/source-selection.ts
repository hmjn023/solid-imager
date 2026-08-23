export interface SelectableSource {
	id: string;
	name: string;
}

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
