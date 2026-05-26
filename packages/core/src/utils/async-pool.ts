/**
 * Process items with a concurrency limit.
 * Returns per-item results via Promise.allSettled-style entries.
 */
export async function asyncPool<T, R = void>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
	const results: PromiseSettledResult<R>[] = new Array(items.length);
	let index = 0;

	async function worker() {
		while (true) {
			const i = index++;
			if (i >= items.length) break;
			try {
				const value = await fn(items[i]);
				results[i] = { status: "fulfilled" as const, value };
			} catch (reason) {
				results[i] = { status: "rejected" as const, reason };
			}
		}
	}

	const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
		worker(),
	);
	await Promise.all(workers);
	return results;
}
