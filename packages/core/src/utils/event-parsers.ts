export type SafeParseSchema<T> = {
	safeParse: (
		input: unknown,
	) => { success: true; data: T } | { success: false; error: unknown };
};

export function parseJsonEventPayload<T>(
	raw: unknown,
	schema: SafeParseSchema<T>,
): { ok: true; data: T } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(String(raw));
		return parseEventPayload(parsed, schema);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		console.error("Failed to parse event JSON:", message);
		return { ok: false, error: message };
	}
}

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
		console.error("Failed to validate event payload:", message);
		return { ok: false, error: message };
	}
	return { ok: true, data: result.data };
}
