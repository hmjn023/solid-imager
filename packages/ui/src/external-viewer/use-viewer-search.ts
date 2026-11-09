import {
	externalSearchSchema,
	viewerProviderSchema,
	type ExternalSearch,
	type ViewerProvider,
} from "@solid-imager/core/external-viewer";
import { createQuery } from "@tanstack/solid-query";
import {
	batch,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { z } from "zod";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";

const session = externalSearchSchema.extend({
	provider: viewerProviderSchema.default("danbooru"),
	draft: z.string().default(""),
	scrollTop: z.number().nonnegative().default(0),
	choices: z.record(z.string(), z.string()).default({}),
});
const key = "solid-imager:external-viewer:search";
export function createViewerSearch<T>(
	provider: ViewerProvider,
	run: (params: ExternalSearch, choices: Record<string, string>) => Promise<T>,
) {
	const [params, setParams] = createSignal(externalSearchSchema.parse({}));
	const [draft, setDraft] = createSignal("");
	const [choices, setChoices] = createSignal<Record<string, string>>({});
	const [ready, setReady] = createSignal(false);
	let area: HTMLDivElement | undefined;
	let restore = 0;
	const persist = () => {
		if (!ready()) return;
		try {
			sessionStorage.setItem(
				key,
				JSON.stringify({
					...params(),
					provider,
					draft: draft(),
					choices: choices(),
					scrollTop: restore || area?.scrollTop || 0,
				}),
			);
		} catch {
			/* optional browser storage */
		}
	};
	onMount(() => {
		try {
			const raw =
				readUiStorageValue(sessionStorage, key) ??
				readUiStorageValue(sessionStorage, UI_STORAGE_KEYS.danbooruSearch);
			const parsed = session.safeParse(raw ? JSON.parse(raw) : null);
			if (parsed.success) {
				const saved = parsed.data,
					same = saved.provider === provider;
				setParams(
					externalSearchSchema.parse({ ...saved, page: same ? saved.page : 1 }),
				);
				setDraft(saved.draft);
				setChoices(saved.choices);
				restore = same ? saved.scrollTop : 0;
			}
		} catch {
			/* A malformed session must not prevent browsing. */
		}
		setReady(true);
	});
	createEffect(persist);
	onCleanup(persist);
	const results = createQuery(() => ({
		queryKey: ["external-viewer", provider, params(), choices()],
		queryFn: () => run(params(), choices()),
		enabled: ready(),
		staleTime: 30_000,
		retry: false,
	}));
	createEffect(() => {
		if (results.data && restore > 0) {
			const top = restore;
			restore = 0;
			requestAnimationFrame(() => {
				if (area) area.scrollTop = top;
			});
		}
	});
	function changePage(page: number) {
		setParams((value) => ({ ...value, page }));
		if (area) area.scrollTop = 0;
	}
	function submit(value = draft()) {
		batch(() => {
			setDraft(value);
			const active = new Set(
				value
					.trim()
					.split(/\s+/)
					.map((token) => token.replace(/^[-~]/, "")),
			);
			setChoices((current) =>
				Object.fromEntries(
					Object.entries(current).filter(([tag]) => active.has(tag)),
				),
			);
			setParams((current) => ({ ...current, tags: value.trim(), page: 1 }));
		});
		if (area) area.scrollTop = 0;
	}
	function choose(tag: string, name: string) {
		batch(() => {
			setChoices((current) => ({ ...current, [tag]: name }));
			changePage(1);
		});
	}
	return {
		params,
		draft,
		setDraft,
		results,
		persist,
		scrollRef: (el: HTMLDivElement) => {
			area = el;
		},
		changePage,
		submit,
		choose,
	};
}
