import { createSignal } from "solid-js";

export function Counter() {
	const [count, setCount] = createSignal(0);
	return (
		<button
			class="w-counter rounded-full border-2 border-input bg-muted px-8 py-4 focus:border-input active:border-input"
			onClick={() => setCount(count() + 1)}
			type="button"
		>
			Clicks: {count()}
		</button>
	);
}
