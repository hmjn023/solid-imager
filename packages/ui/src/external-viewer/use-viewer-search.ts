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
	createMemo,
	createSignal,
	onCleanup,
	onMount,
} from "solid-js";
import { z } from "zod";
import { toQueryUiState } from "../query-state";
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
	identity?: { scope: () => (string | number)[]; ready: () => boolean },
) {
	const [params, setParams] = createSignal(externalSearchSchema.parse({}));
	const [draft, setDraft] = createSignal("");
	const [choices, setChoices] = createSignal<Record<string, string>>({});
	const [ready, setReady] = createSignal(false);
	const [scrollArea, setScrollArea] = createSignal<HTMLDivElement>();
	let scrollTop = 0;
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
					scrollTop,
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
				scrollTop = same ? saved.scrollTop : 0;
			}
		} catch {
			/* A malformed session must not prevent browsing. */
		}
		setReady(true);
	});
	createEffect(persist);
	onCleanup(persist);
	const results = createQuery(() => ({
		queryKey: [
			"external-viewer",
			provider,
			params(),
			choices(),
			...(identity?.scope() ?? []),
		],
		queryFn: () => run(params(), choices()),
		enabled: ready() && (identity?.ready() ?? true),
		gcTime: identity ? 0 : undefined,
		staleTime: 30_000,
		retry: false,
	}));
	// An unresolved query's data accessor suspends its parent. Keep the search field
	// mounted while this page of results is loading.
	const state = createMemo(() =>
		toQueryUiState({
			data: results.isPending ? undefined : results.data,
			error: results.error,
			status: results.status,
			fetchStatus: results.fetchStatus,
		}),
	);
	createEffect(() => {
		const area = scrollArea();
		if (!area || !scrollTop || !state().data) return;
		const frame = requestAnimationFrame(() => {
			area.scrollTop = scrollTop;
		});
		onCleanup(() => cancelAnimationFrame(frame));
	});
	function rememberScroll() {
		const area = scrollArea();
		if (area) scrollTop = area.scrollTop;
		persist();
	}
	function resetScroll() {
		scrollTop = 0;
		const area = scrollArea();
		if (area) area.scrollTop = 0;
	}
	function changePage(page: number) {
		resetScroll();
		setParams((value) => ({ ...value, page }));
	}
	function submit(value = draft()) {
		resetScroll();
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
		state,
		rememberScroll,
		scrollArea,
		setScrollArea,
		changePage,
		submit,
		choose,
	};
}
