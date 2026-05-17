/**
 * Simple deep equality check for JSON-serializable objects.
 * Handles objects, arrays, and primitives.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (
		typeof a !== "object" ||
		a === null ||
		typeof b !== "object" ||
		b === null
	) {
		return false;
	}

	const keysA = Object.keys(a as object);
	const keysB = Object.keys(b as object);

	if (keysA.length !== keysB.length) {
		return false;
	}

	// Only create a Set for larger objects to avoid overhead on small objects
	const keysBSet = keysB.length > 5 ? new Set(keysB) : null;

	for (const key of keysA) {
		if (keysBSet ? !keysBSet.has(key) : !keysB.includes(key)) {
			return false;
		}
		if (
			!deepEqual(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			)
		) {
			return false;
		}
	}

	return true;
}
