import {
	createEffect,
	createSignal,
	on,
	onCleanup,
	onMount,
	type Accessor,
} from "solid-js";
import { z } from "zod";

export function createViewerRecentHistory<Entry>(
	prefix: string,
	scope: Accessor<string | undefined>,
	schema: z.ZodType<Entry>,
	identify: (entry: Entry) => string | number,
	limit: number,
) {
	const historySchema = z.array(schema).max(limit);
	function readHistory(key: string): Entry[] | undefined {
		try {
			const raw = localStorage.getItem(key);
			if (raw === null) return [];
			const parsed = historySchema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : [];
		} catch {
			return undefined;
		}
	}

	const key = () => {
		const value = scope();
		return value === undefined ? undefined : prefix + value;
	};
	const [snapshot, setSnapshot] = createSignal<{
		key: string;
		entries: Entry[];
	}>();
	const entries = () => {
		const current = snapshot();
		return current && current.key === key() ? current.entries : [];
	};

	function refresh(storageKey: string) {
		const stored = readHistory(storageKey);
		if (stored) setSnapshot({ key: storageKey, entries: stored });
	}

	createEffect(
		on(key, (storageKey) => {
			if (storageKey) refresh(storageKey);
		}),
	);
	onMount(() => {
		const sync = (event: StorageEvent) => {
			const storageKey = key();
			if (storageKey && (event.key === storageKey || event.key === null))
				refresh(storageKey);
		};
		window.addEventListener("storage", sync);
		onCleanup(() => window.removeEventListener("storage", sync));
	});

	function update(apply: (current: Entry[]) => Entry[]) {
		const storageKey = key();
		if (!storageKey) return;
		const next = apply(readHistory(storageKey) ?? entries());
		setSnapshot({ key: storageKey, entries: next });
		try {
			if (next.length) localStorage.setItem(storageKey, JSON.stringify(next));
			else localStorage.removeItem(storageKey);
		} catch {
			return;
		}
	}

	return {
		entries,
		record: (input: Entry) => {
			const parsed = schema.safeParse(input);
			if (!parsed.success) return;
			const entry = parsed.data;
			const id = identify(entry);
			update((current) =>
				[entry, ...current.filter((item) => identify(item) !== id)].slice(
					0,
					limit,
				),
			);
		},
		clear: () => update(() => []),
	};
}
