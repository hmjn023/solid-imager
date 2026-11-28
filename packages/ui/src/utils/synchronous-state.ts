import { createSignal } from "solid-js";

/** Commands read their latest snapshot immediately, while views follow Solid's commit. */
export function createSynchronousState<T>(initialValue: T) {
	let current = initialValue;
	const [snapshot, publish] = createSignal({ value: initialValue });
	const set = (value: T) => {
		if (!Object.is(value, current)) {
			current = value;
			publish({ value });
		}
		return value;
	};
	return {
		current: () => current,
		read: () => snapshot().value,
		set,
		update: (change: (value: T) => T) => set(change(current)),
	};
}
