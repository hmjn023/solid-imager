/** Test host: keep a dedicated runner separate from the API/job observer. */
export function runScheduledObserver<T>(
	observe: Promise<T>,
	runOnce: () => Promise<string>,
): Promise<T> {
	let finished = false;
	const observed = observe.finally(() => {
		finished = true;
	});
	const worker = (async () => {
		while (!finished) {
			await runOnce();
			if (!finished)
				await new Promise<void>((resolve) => setTimeout(resolve, 5));
		}
	})();
	return observed.then(
		async (value) => {
			await worker;
			return value;
		},
		async (error) => {
			await worker;
			throw error;
		},
	);
}
