/** Minimal validation interface accepted by the event payload parsers. */
export type SafeParseSchema<T> = {
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

/**
 * Parses a JSON event payload and validates it, returning errors as strings.
 * @param raw - Value converted to a string before JSON parsing.
 * @param schema - Validator for the parsed value.
 * @returns Validated data, or a parsing or validation error message.
 */
export function parseJsonEventPayload<T>(
	raw: unknown,
	schema: SafeParseSchema<T>,
): { ok: true; data: T } | { ok: false; error: string } {
	try {
		const parsed: unknown = JSON.parse(String(raw));
		return parseEventPayload(parsed, schema);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		return { ok: false, error: message };
	}
}

/**
 * Validates an already decoded event payload without throwing validation errors.
 * @param raw - Decoded value to validate.
 * @param schema - Validator for the payload.
 * @returns Validated data, or a validation error message.
 */
export function parseEventPayload<T>(
	raw: unknown,
	schema: SafeParseSchema<T>,
): { ok: true; data: T } | { ok: false; error: string } {
	const result = schema.safeParse(raw);
	if (!result.success) {
		const message =
			result.error instanceof Error
				? result.error.message
				: String(result.error);
		return { ok: false, error: message };
	}
	return { ok: true, data: result.data };
}
