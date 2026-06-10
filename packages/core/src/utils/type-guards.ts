/**
 * Type guard to check if a value is a plain object (Record<string, unknown>).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Type guard to check if a value is a number.
 */
export function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}
