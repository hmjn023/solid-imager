export function deepMerge<T>(base: T, patch: Partial<T>): T {
	if (
		base === null ||
		patch === null ||
		typeof base !== "object" ||
		typeof patch !== "object" ||
		Array.isArray(base) ||
		Array.isArray(patch)
	) {
		return (patch as T) ?? base;
	}

	const result: Record<string, unknown> = {
		...(base as Record<string, unknown>),
	};
	for (const [key, value] of Object.entries(patch)) {
		if (value === undefined) {
			continue;
		}
		const current = result[key];
		result[key] =
			current &&
			value &&
			typeof current === "object" &&
			typeof value === "object" &&
			!Array.isArray(current) &&
			!Array.isArray(value)
				? deepMerge(current as Record<string, unknown>, value as Record<string, unknown>)
				: value;
	}
	return result as T;
}
