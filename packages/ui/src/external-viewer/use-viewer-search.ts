import {
	externalSearchSchema,
	pixivBookmarkFilterSchema,
	pixivFeedSchema,
	viewerProviderSchema,
	type ExternalSearch,
	type PixivBookmarkFilter,
	type ViewerProvider,
} from "@solid-imager/core/external-viewer";
import {
	createInfiniteQuery,
	type InfiniteData,
	useQueryClient,
} from "@tanstack/solid-query";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	on,
	onCleanup,
	onMount,
} from "solid-js";
import { z } from "zod";
import { toQueryUiState } from "../query-state";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";
import type { ViewerGridHandle } from "./results-grid";
import type { ViewerSearchHistoryEntry } from "./viewer-search-history";
import {
	type PixivCollection,
	viewerPagination,
	viewerSearchKey,
} from "./query-options";

const authorSchema = z.object({
	id: z
		.string()
		.regex(/^[1-9]\d*$/)
		.max(30),
	name: z.string(),
});
const pixivCollectionSchema = pixivFeedSchema.or(z.literal("bookmarks"));
const defaultBookmarkFilter: PixivBookmarkFilter = {
	visibility: "public",
	tag: "",
};
const session = externalSearchSchema.extend({
	pixivFeed: pixivCollectionSchema.optional(),
	bookmarkFilter: pixivBookmarkFilterSchema.optional(),
	author: authorSchema.optional(),
	provider: viewerProviderSchema.default("danbooru"),
	literalPixivTag: z.boolean().default(false),
	draft: z.string().default(""),
	scrollTop: z.number().nonnegative().default(0),
	choices: z.record(z.string(), z.string()).default({}),
	scope: z.string().optional(),
	anchor: z
		.object({ index: z.number().int().nonnegative(), offset: z.number() })
		.optional(),
	detailPage: externalSearchSchema.shape.page.unwrap().optional(),
});
const key = "solid-imager:external-viewer:search";

type ViewerPage = { posts: { id: number }[]; hasNextPage: boolean };
type Position = { page: number; index: number };
type ScrollAnchor = Position & { offset: number };

export function createViewerSearch<T extends ViewerPage>(
	provider: ViewerProvider,
	run: (
		params: ExternalSearch,
		choices: Record<string, string>,
		literalPixivTag: boolean,
		pixivUserId?: string,
		bookmark?: PixivBookmarkFilter,
	) => Promise<T>,
	identity?: { scope: () => (string | number)[]; ready: () => boolean },
	selectedPostId?: () => number | undefined,
	onCommitSearch?: (entry: ViewerSearchHistoryEntry) => void,
) {
	const client = useQueryClient();
	const initialScope = JSON.stringify(identity?.scope() ?? []);
	const [author, setAuthor] = createSignal<z.infer<typeof authorSchema>>();
	const [literalPixivTag, setLiteralPixivTag] = createSignal(false);
	const [pixivFeed, setPixivFeed] = createSignal<PixivCollection>("daily");
	const [bookmarkFilter, setBookmarkFilter] = createSignal(
		defaultBookmarkFilter,
	);
	const showingBookmarks = () =>
		pixivFeed() === "bookmarks" && !tags() && !author();
	const [tags, setTags] = createSignal("");
	const [draft, setDraft] = createSignal("");
	const [choices, setChoices] = createSignal<Record<string, string>>({});
	const [firstPage, setFirstPage] = createSignal(1);
	const [mounted, setMounted] = createSignal(false);
	const [scope, setScope] = createSignal<string>();
	const [scrollArea, setScrollArea] = createSignal<HTMLDivElement>();
	const [hasScrolled, setHasScrolled] = createSignal(false);
	const [gridHandle, setGridHandle] = createSignal<ViewerGridHandle>();
	const [restorePending, setRestoring] = createSignal(false);
	const [prepending, setPrepending] = createSignal(false);
	const restoring = () => (restorePending() || prepending()) && !!scrollArea();
	let restoreAfterPage: number | undefined;
	let prependFrom: number | undefined;
	let revision = 0;
	let scrollTop = 0;
	let anchor: ScrollAnchor | undefined;
	let detailPage: number | undefined;
	const persist = () => {
		if (scope() === undefined) return;
		try {
			sessionStorage.setItem(
				key,
				JSON.stringify({
					tags: tags(),
					pixivFeed: pixivFeed(),
					bookmarkFilter:
						pixivFeed() === "bookmarks" ? bookmarkFilter() : undefined,
					author: author(),
					literalPixivTag: literalPixivTag(),
					page: anchor?.page ?? firstPage(),
					anchor: anchor && { index: anchor.index, offset: anchor.offset },
					choices: choices(),
					detailPage,
					draft: draft(),
					provider,
					scope: scope(),
					scrollTop,
				}),
			);
		} catch {
			/* optional browser storage */
		}
	};

	function resetScroll() {
		revision++;
		restoreAfterPage = undefined;
		setPrepending(false);
		anchor = undefined;
		scrollTop = 0;
		detailPage = undefined;
		setFirstPage(1);
		setHasScrolled(false);
		setRestoring(false);
		const area = scrollArea();
		if (area) area.scrollTop = 0;
	}

	onMount(() => setMounted(true));
	createEffect(
		on(
			() =>
				mounted() && (identity?.ready() ?? true)
					? JSON.stringify(identity?.scope() ?? [])
					: undefined,
			(currentScope) => {
				if (currentScope === undefined) return;
				if (scope() !== undefined) {
					// The same Pixiv screen can change accounts while it is mounted.
					batch(() => {
						resetScroll();
						setBookmarkFilter(defaultBookmarkFilter);
						if (pixivFeed() === "bookmarks") setPixivFeed("daily");
						setScope(currentScope);
					});
					return;
				}
				try {
					const raw =
						readUiStorageValue(sessionStorage, key) ??
						readUiStorageValue(sessionStorage, UI_STORAGE_KEYS.danbooruSearch);
					const parsed = session.safeParse(raw ? JSON.parse(raw) : null);
					if (parsed.success) {
						const saved = parsed.data;
						setLiteralPixivTag(
							provider === "pixiv" &&
								saved.provider === provider &&
								saved.literalPixivTag,
						);
						setAuthor(
							provider === "pixiv" && saved.provider === provider
								? saved.author
								: undefined,
						);
						setPixivFeed(
							provider === "pixiv" &&
								saved.provider === provider &&
								((saved.pixivFeed !== "follow" &&
									saved.pixivFeed !== "bookmarks") ||
									saved.scope === currentScope)
								? (saved.pixivFeed ?? "daily")
								: "daily",
						);
						if (pixivFeed() === "bookmarks")
							setBookmarkFilter(saved.bookmarkFilter ?? defaultBookmarkFilter);
						setTags(saved.tags);
						setDraft(saved.draft);
						setChoices(saved.choices);
						if (
							saved.provider === provider &&
							(saved.scope === currentScope ||
								(!identity && saved.scope === undefined))
						) {
							if (saved.anchor) anchor = { page: saved.page, ...saved.anchor };
							scrollTop = saved.scrollTop;
							detailPage = selectedPostId?.() ? saved.detailPage : undefined;
							setFirstPage(detailPage ?? saved.page);
							setRestoring(Boolean(anchor || scrollTop));
						}
					}
				} catch {
					/* A malformed session must not prevent browsing. */
				}
				setScope(currentScope);
			},
		),
	);
	createEffect(persist);
	onCleanup(() => {
		revision++;
		persist();
	});

	const queryKey = (
		word: string,
		mappings: Record<string, string>,
		literal = literalPixivTag(),
		userId: string | null = author()?.id ?? null,
		feed = pixivFeed(),
		bookmark = bookmarkFilter(),
		page = firstPage(),
	) =>
		viewerSearchKey(
			provider,
			scope() ?? initialScope,
			page,
			word,
			mappings,
			literal,
			userId,
			feed,
			bookmark,
		);
	const results = createInfiniteQuery<
		T,
		Error,
		InfiniteData<T, number>,
		ReturnType<typeof queryKey>,
		number
	>(() => {
		const word = tags(),
			mappings = choices(),
			literal = literalPixivTag(),
			userId = author()?.id,
			feed = pixivFeed(),
			bookmark = showingBookmarks() ? bookmarkFilter() : undefined;
		return {
			queryKey: queryKey(word, mappings, literal, userId ?? null, feed),
			queryFn: ({ pageParam }) =>
				run(
					{
						tags: word,
						page: pageParam,
						...(provider === "pixiv" && feed !== "bookmarks"
							? { pixivFeed: feed }
							: {}),
					},
					mappings,
					literal,
					userId,
					bookmark,
				),
			...viewerPagination(firstPage()),
			enabled: scope() !== undefined,
			gcTime: identity ? 0 : undefined,
			staleTime: 30_000,
			// Refetching an infinite query replays every loaded provider page.
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: false,
		};
	});
	const collection = createMemo(() => {
		// Pending data suspends the entire route, including the focused search input.
		const data = results.isPending ? undefined : results.data;
		if (!data || !data.pages.length) return;
		const positions = new Map<number, Position>();
		const posts: T["posts"][number][] = [];
		const firstOnly = new Set(data.pages[0].posts.map((post) => post.id));
		const grows = data.pages.map((page, i) => {
			const length = posts.length;
			page.posts.forEach((post, index) => {
				if (i > 0) firstOnly.delete(post.id);
				if (positions.has(post.id)) return;
				positions.set(post.id, { page: data.pageParams[i], index });
				posts.push(post);
			});
			return posts.length > length;
		});
		return {
			result: { ...data.pages[0], posts, hasNextPage: results.hasNextPage },
			pages: data,
			positions,
			lastPageGrew: grows.at(-1) === true,
			firstPageGrew: firstOnly.size > 0,
		};
	});
	const state = createMemo(() =>
		toQueryUiState<T>({
			data: collection()?.result,
			error: results.error,
			status: results.status,
			fetchStatus: results.fetchStatus,
		}),
	);

	function rememberScroll() {
		const area = scrollArea();
		if (!area || restorePending()) return;
		// Allow the user to keep scrolling while waiting for the previous response.
		// Once the first page changes, browser anchoring may emit transient positions.
		if (prepending() && collection()?.pages.pageParams[0] !== prependFrom)
			return;
		scrollTop = area.scrollTop;
		const visible = gridHandle()?.getAnchor();
		const position = visible && collection()?.positions.get(visible.id);
		if (position && visible) anchor = { ...position, offset: visible.offset };
		persist();
	}
	function handleScroll() {
		if (
			provider === "pixiv" &&
			!restoring() &&
			(scrollArea()?.scrollTop ?? 0) > 0
		)
			setHasScrolled(true);
		rememberScroll();
	}
	function rememberDetail(id: number | undefined) {
		const position =
			id === undefined ? undefined : collection()?.positions.get(id);
		if (position) detailPage = position.page;
		else if (id === undefined) detailPage = undefined;
		persist();
	}

	// Restoring by page and ordinal avoids storing remote posts (including private
	// artwork IDs) and allows a cold reload to start near the last visible tile.
	createEffect(() => {
		const area = scrollArea(),
			handle = gridHandle(),
			loaded = collection();
		if (
			!restorePending() ||
			prepending() ||
			!area ||
			!loaded ||
			(restoreAfterPage !== undefined &&
				loaded.pages.pageParams[0] !== restoreAfterPage) ||
			(loaded.result.posts.length && !handle)
		)
			return;
		const saved = anchor;
		const pageIndex = saved ? loaded.pages.pageParams.indexOf(saved.page) : -1;
		if (saved && pageIndex < 0 && firstPage() !== saved.page) {
			// Reloading a detail can start on a different page than its collection
			// viewport. Jump directly to the viewport's page when returning.
			restoreAfterPage = saved.page;
			setFirstPage(saved.page);
			return;
		}
		const post = saved && loaded.pages.pages[pageIndex]?.posts[saved.index];
		let cancelled = false;
		const restore = async () => {
			if (post && saved && handle) {
				await handle.restoreAnchor({ id: post.id, offset: saved.offset });
			} else {
				area.scrollTop = scrollTop;
			}
			if (!cancelled) {
				restoreAfterPage = undefined;
				setRestoring(false);
			}
		};
		const frame = requestAnimationFrame(() => {
			void restore();
		});
		onCleanup(() => {
			cancelled = true;
			cancelAnimationFrame(frame);
		});
	});
	function registerGrid(handle: ViewerGridHandle | undefined) {
		setGridHandle(handle);
		if (!handle && (anchor || scrollTop)) setRestoring(true);
	}

	async function loadMore() {
		if (
			scope() !== undefined &&
			!restoring() &&
			results.hasNextPage &&
			!results.isFetching
		) {
			await results.fetchNextPage({ cancelRefetch: false });
		}
	}
	async function loadPrevious() {
		if (
			scope() === undefined ||
			restoring() ||
			!results.hasPreviousPage ||
			results.isFetching
		)
			return;
		const area = scrollArea();
		const previousRevision = revision;
		const previousFirst = collection()?.pages.pageParams[0];
		rememberScroll();
		// Freeze the visible row until the prepended page has reached both the query
		// observer and the virtual grid. Browser scroll anchoring may emit intermediate scroll events.
		if (area) {
			prependFrom = previousFirst;
			setPrepending(true);
		}
		try {
			const { data } = await results.fetchPreviousPage({
				cancelRefetch: false,
			});
			if (revision !== previousRevision || !area || area !== scrollArea())
				return;
			const newFirst = data?.pageParams[0];
			if (
				newFirst !== undefined &&
				newFirst !== previousFirst &&
				(anchor || scrollTop)
			) {
				restoreAfterPage = newFirst;
				setRestoring(true);
			}
		} finally {
			if (revision === previousRevision) setPrepending(false);
		}
	}

	function restart(
		word: string,
		mappings: Record<string, string>,
		literal = false,
		nextAuthor?: z.infer<typeof authorSchema>,
		feed = pixivFeed(),
		bookmark = bookmarkFilter(),
	) {
		const nextKey = queryKey(
			word,
			mappings,
			literal,
			nextAuthor?.id ?? null,
			feed,
			bookmark,
			1,
		);
		const cached = client.getQueryState(nextKey);
		batch(() => {
			resetScroll();
			setAuthor(nextAuthor);
			setPixivFeed(feed);
			setBookmarkFilter(bookmark);
			setLiteralPixivTag(literal);
			setTags(word);
			setChoices(mappings);
		});
		if (cached) void client.resetQueries({ queryKey: nextKey, exact: true });
	}
	function submit(value = draft(), literal?: boolean) {
		const word = value.trim();
		const exactTag =
			literal ?? (provider === "pixiv" && literalPixivTag() && word === tags());
		const active = new Set(
			word.split(/\s+/).map((token) => token.replace(/^[-~]/, "")),
		);
		const mappings = exactTag
			? {}
			: Object.fromEntries(
					Object.entries(choices()).filter(([tag]) => active.has(tag)),
				);
		setDraft(provider === "pixiv" && word ? word + " " : value);
		commitSearch({ tags: word, literalPixivTag: exactTag, choices: mappings });
	}
	function commitSearch(entry: ViewerSearchHistoryEntry) {
		restart(entry.tags, entry.choices, entry.literalPixivTag);
		if (entry.tags) onCommitSearch?.(entry);
	}
	function choose(tag: string, name: string) {
		if (choices()[tag] !== name)
			commitSearch({
				tags: tags(),
				literalPixivTag: literalPixivTag(),
				choices: { ...choices(), [tag]: name },
			});
	}
	const canAutoLoadNext = () =>
		scope() !== undefined &&
		results.hasNextPage &&
		collection()?.lastPageGrew === true;

	return {
		pixivFeed,
		showingBookmarks,
		bookmarkFilter,
		selectBookmarkFilter: (bookmark: PixivBookmarkFilter) =>
			restart("", {}, false, undefined, "bookmarks", bookmark),
		selectFeed: (feed: PixivCollection) => {
			setDraft("");
			restart("", {}, false, undefined, feed);
		},
		author,
		openAuthor: (id: string, name: string) => {
			setDraft("");
			restart("", {}, false, { id, name });
		},
		draft,
		setDraft,
		results,
		state,
		rememberScroll,
		handleScroll,
		rememberDetail,
		scrollArea,
		setScrollArea,
		gridHandle,
		setGridHandle: registerGrid,
		restoring,
		hasNextPage: () => results.hasNextPage,
		hasPreviousPage: () => results.hasPreviousPage,
		canAutoLoadNext,
		onlyFillViewport: () => provider === "pixiv" && !hasScrolled(),
		canAutoLoadPrevious: () =>
			scope() !== undefined &&
			results.hasPreviousPage &&
			collection()?.firstPageGrew === true,
		loadMore,
		loadPrevious,
		submit,
		restoreSearch: (entry: ViewerSearchHistoryEntry) => {
			setDraft(entry.tags + " ");
			commitSearch(entry);
		},
		choose,
	};
}
