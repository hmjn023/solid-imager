/**
 * Safely parse a string value from a select component into a typed union.
 * Returns the fallback if the value is not in the valid set.
 */
export function parseSelectValue<T extends string>(
	value: string | undefined | null,
	validValues: readonly T[],
	fallback: T,
): T {
	if (value != null && validValues.includes(value as T)) {
		return value as T;
	}
	return fallback;
}
