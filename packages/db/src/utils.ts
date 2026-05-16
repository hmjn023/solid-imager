export function escapeLikeString(str: string): string {
	return str.replace(/[%_]/g, "\\$&");
}

export function paginatedQuery<T>(
	query: T,
	options: { limit?: number; offset?: number },
): T {
	const q = query as any;
	if (options.limit !== undefined) {
		return q.limit(options.limit).offset(options.offset || 0) as T;
	}
	if (options.offset !== undefined && options.offset > 0) {
		return q.offset(options.offset) as T;
	}
	return query;
}
