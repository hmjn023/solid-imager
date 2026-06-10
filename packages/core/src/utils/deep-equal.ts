import { isRecord } from "./type-guards";

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

	if (!isRecord(a) || !isRecord(b)) {
		return false;
	}

	const keysA = Object.keys(a);
	const keysB = Object.keys(b);

	if (keysA.length !== keysB.length) {
		return false;
	}

	// Only create a Set for larger objects to avoid overhead on small objects
	const keysBSet = keysB.length > 5 ? new Set(keysB) : null;

	for (const key of keysA) {
		if (keysBSet ? !keysBSet.has(key) : !keysB.includes(key)) {
			return false;
		}
		if (!deepEqual(a[key], b[key])) {
			return false;
		}
	}

	return true;
}
