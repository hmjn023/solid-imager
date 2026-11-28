import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

/** A client-side request whose inline loading, error, and retry controls stay mounted. */
export function createRequest<Input, Value>(
	input: Accessor<Input | false | undefined>,
	fetchValue: (input: Input) => Promise<Value>,
) {
	const [data, setData] = createSignal<Value>();
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<unknown>();
	let generation = 0;

	async function load(value: Input): Promise<Value | undefined> {
		const request = ++generation;
		setLoading(true);
		setError(undefined);
		try {
			const result = await fetchValue(value);
			if (request === generation) setData(() => result);
			return result;
		} catch (reason) {
			if (request === generation) setError(() => reason);
			throw reason;
		} finally {
			if (request === generation) setLoading(false);
		}
	}

	createEffect(input, (value) => {
		if (value !== false && value !== undefined) {
			void load(value).catch(() => undefined);
		} else {
			generation++;
			setLoading(false);
		}
	});
	onCleanup(() => {
		generation++;
	});

	return {
		data,
		loading,
		error,
		refetch: () => {
			const value = input();
			return value === false || value === undefined
				? Promise.resolve(undefined)
				: load(value);
		},
	};
}
