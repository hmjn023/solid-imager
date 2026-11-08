import { createSignal, onCleanup } from "solid-js";

/** Creates a signal whose setter applies only the latest value after the delay; pending updates are cancelled on cleanup. */
export function createDebouncedSignal<T>(
	initialValue: T,
	delayMs: number,
): [() => T, (value: T) => void] {
	const [debounced, setDebounced] = createSignal<T>(initialValue);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const setter = (newValue: T) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			setDebounced(() => newValue);
			timer = null;
		}, delayMs);
	};

	onCleanup(() => {
		if (timer) clearTimeout(timer);
	});

	return [debounced, setter];
}
