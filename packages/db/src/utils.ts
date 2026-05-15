export function escapeLikeString(str: string): string {
	return str.replace(/[%_]/g, "\\$&");
}

export function paginatedQuery(
	query: { limit: (n: number) => { offset: (n: number) => unknown } } & { offset: (n: number) => unknown },
	options: { limit?: number; offset?: number },
): unknown {
	if (options.limit !== undefined) {
		return query.limit(options.limit).offset(options.offset || 0);
	}
	if (options.offset !== undefined && options.offset > 0) {
		return query.offset(options.offset);
	}
	return query;
}
