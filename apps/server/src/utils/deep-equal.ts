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

	const keysBSet = new Set(keysB);

	for (const key of keysA) {
		if (!keysBSet.has(key)) {
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
