import {
	clearPixivRelatedSnapshots,
	type PixivRelatedSnapshot,
} from "../external-viewer/pixiv-related-history";
import { t } from "@solid-imager/i18n";
import type { AppContractClient } from "@solid-imager/core/contract";
import type {
	PixivCard,
	PixivSearchResult,
} from "@solid-imager/core/external-viewer";
import { useQuery } from "@tanstack/solid-query";
import { ClientOnly } from "@tanstack/solid-router";
import Clock3 from "@lucide/solid/icons/clock-3";
import Search from "@lucide/solid/icons/search";
import UserRound from "@lucide/solid/icons/user-round";
import { Button } from "../button";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { Dialog } from "../dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "../dropdown-menu";
import { ViewerActionsMenu } from "../external-viewer/actions-menu";
import type { createViewerImports } from "../external-viewer/viewer-imports";
import {
	createPixivAccount,
	type ViewerFetch,
	type PixivClientFactory,
	PixivAccountDialog,
} from "../external-viewer/pixiv-account";
import { PixivRelatedWorks } from "../external-viewer/pixiv-related-works";
import { PixivArtworkDetail } from "../external-viewer/pixiv-artwork-detail";
import { createPixivViewingHistory } from "../external-viewer/pixiv-viewing-history";
import {
	PixivViewingHistoryContent,
	PixivViewingHistoryDialog,
} from "../external-viewer/pixiv-viewing-history-dialog";
import { createPixivSearchHistory } from "../external-viewer/viewer-search-history";
import { ViewerSearchHistoryContent } from "../external-viewer/viewer-search-history-dialog";
import { pixivThumbnailSource } from "../external-viewer/post-media";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import { viewerPostQueryOptions } from "../external-viewer/query-options";
import { PixivBookmarkFilters } from "../external-viewer/pixiv-bookmark-filters";
import { PixivBookmarkAction } from "../external-viewer/pixiv-bookmark-action";
import { readQueryData } from "../query-state";
import {
	ViewerWorkspace,
	type ViewerNavigation,
} from "../external-viewer/workspace";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";

type PixivToolbarDialog = "viewingHistory" | "searchHistory" | "account";

type PixivProps = ViewerNavigation & {
	client: Pick<AppContractClient, "viewer">;
	imports: ReturnType<typeof createViewerImports>;
	apiBase: () => string;
	fetch?: ViewerFetch;
	createViewer: PixivClientFactory;
	openPixivLogin?: () => Promise<void>;
};

function feedOptions() {
	return [
		{ value: "daily" as const, label: t("pixivScreen.dailyRanking") },
		{ value: "weekly" as const, label: t("pixivScreen.weeklyRanking") },
		{ value: "monthly" as const, label: t("pixivScreen.monthlyRanking") },
		{ value: "rookie" as const, label: t("pixivScreen.rookieRanking") },
		{ value: "follow" as const, label: t("pixivScreen.followLatest") },
		{ value: "bookmarks" as const, label: t("pixivBookmarks.title") },
	];
}
function PixivSearchInfo(props: {
	data: PixivSearchResult;
	onChoose: (tag: string, value: string) => void;
}) {
	const tagChoices = createMemo(() =>
		props.data.mappings.filter((row) => row.names.length > 1),
	);
	return (
		<Show when={props.data.word || tagChoices().length > 0}>
			<div class="mb-3 space-y-2">
				<Show when={props.data.word}>
					{(word) => (
						<p
							class="break-words text-muted-foreground text-sm"
							aria-live="polite"
						>
							{t("pixivScreen.pixivSearch", { word: word() })}
						</p>
					)}
				</Show>
				<For each={tagChoices()}>
					{(row) => (
						<div class="flex min-w-0 items-center gap-2">
							<span class="truncate text-sm">{row.tag}</span>
							<Select
								options={row.names}
								value={row.selected}
								onChange={(value) => {
									if (value) props.onChoose(row.tag, value);
								}}
								itemComponent={(item) => (
									<SelectItem item={item.item}>{item.item.rawValue}</SelectItem>
								)}
							>
								<SelectTrigger
									aria-label={t("pixivScreen.pixivTags", { tag: row.tag })}
								>
									<SelectValue<string>>
										{(state) => state.selectedOption()}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
						</div>
					)}
				</For>
			</div>
		</Show>
	);
}
export function PixivScreen(props: PixivProps) {
	return (
		<Show when={props.apiBase()} keyed>
			{(base) => <PixivScreenForServer {...props} base={base} />}
		</Show>
	);
}

function PixivScreenForServer(props: PixivProps & { base: string }) {
	const account = createPixivAccount(
		props.base,
		(base, request) => props.createViewer(base, request),
		(url, init) => props.fetch?.(url, init) ?? fetch(url, init),
	);
	const [toolbarDialog, setToolbarDialog] = createSignal<PixivToolbarDialog>();
	let pendingToolbarDialog: PixivToolbarDialog | undefined;
	let toolbarTrigger: HTMLButtonElement | undefined;
	const openPendingToolbarDialog = () => {
		const dialog = pendingToolbarDialog;
		pendingToolbarDialog = undefined;
		// Wait for the menu's focus scope to finish before mounting the dialog.
		if (dialog) {
			queueMicrotask(() => {
				if (toolbarTrigger?.isConnected) setToolbarDialog(dialog);
			});
		}
	};
	const closeToolbarDialog = (open: boolean) => {
		if (!open) setToolbarDialog(undefined);
	};
	const restoreToolbarFocus = (event: Event) => {
		event.preventDefault();
		toolbarTrigger?.focus({ preventScroll: true });
	};
	const historyScope = () =>
		account.ready()
			? JSON.stringify([props.apiBase(), account.session()?.userId ?? "guest"])
			: undefined;
	const searchHistory = createPixivSearchHistory(historyScope);
	const browse = createViewerSearch<PixivSearchResult>(
		"pixiv",
		async (input, choices, literalPixivTag, pixivUserId, bookmark) => {
			const viewer = account.transport().viewer;
			if (bookmark)
				return viewer.pixivBookmarks({ ...bookmark, page: input.page });
			const result = await viewer.search({
				...input,
				provider: "pixiv",
				literalPixivTag,
				pixivUserId,
				choices,
			});
			if (result.provider !== "pixiv")
				throw new Error(t("pixivScreen.searchDestinationDoesNotMatch"));
			return result;
		},
		account,
		() => props.selectedPostId,
		(entry) => searchHistory.record(entry),
	);
	const relatedHistory = new Map<string, PixivRelatedSnapshot>();
	createEffect(
		() => (account.ready() ? JSON.stringify(account.scope()) : undefined),
		(scope, previous) => {
			if (previous && previous !== scope) {
				relatedHistory.clear();
				clearPixivRelatedSnapshots();
				if (!account.session() && browse.pixivFeed() === "follow")
					browse.selectFeed("daily");
			}
		},
	);
	const detail = useQuery(() => ({
		...viewerPostQueryOptions(
			"pixiv",
			props.selectedPostId,
			(id) => account.transport().viewer.pixivArtwork({ id }),
			account.scope(),
		),
		enabled: account.ready() && !!props.selectedPostId,
		gcTime: 0,
	}));
	const history = createPixivViewingHistory(historyScope);
	createEffect(
		() => {
			if (!account.ready() || !detail.isSuccess) return;
			const post = readQueryData(detail);
			return post?.id === props.selectedPostId ? post : undefined;
		},
		(post, previous) => {
			if (post && post.id !== previous?.id) history.record(post);
		},
	);
	const describePost = (post: PixivCard) => ({
		title:
			post.title || t("pixivScreen.pixivValue", { value0: String(post.id) }),
		thumbnail: pixivThumbnailSource(props.apiBase(), post.thumbnail),
		info: [post.author, t("pixivScreen.imageCount", { count: post.pageCount })]
			.filter(Boolean)
			.join(" · "),
	});
	const viewingHistory = {
		get posts() {
			return history.posts();
		},
		describePost,
		get postHref() {
			return props.postHref;
		},
		onOpenPost(id: number) {
			if (id !== props.selectedPostId) {
				browse.rememberScroll();
				props.onOpenPost(id);
			}
		},
		onClear: history.clear,
	};
	const accountLabel = () => {
		const session = account.session();
		return session
			? t("pixivAccount.pixivIDValue", { value0: session.userId })
			: t("pixivAccount.logInToPixiv");
	};
	const emptyDescription = (data: PixivSearchResult) => {
		if (browse.author()) return t("pixivScreen.emptyAuthor");
		if (data.word) return t("workspace.changeTheTagsAndSearchAgain");
		if (browse.showingBookmarks()) return t("pixivScreen.emptyBookmarks");
		if (browse.pixivFeed() === "follow") return t("pixivScreen.emptyFollowing");
		return t("pixivScreen.emptyRanking");
	};
	return (
		<ViewerWorkspace
			{...props}
			providerName="pixiv"
			browse={browse}
			suggestTags={(query) => props.client.viewer.suggestTags({ query })}
			errorTitle={t("pixivScreen.couldNotSearchPixiv")}
			emptyTitle={t("pixivScreen.noMatchingWorks")}
			emptyDescription={emptyDescription}
			actions={
				<ClientOnly>
					<Select
						options={feedOptions()}
						optionValue="value"
						optionTextValue="label"
						optionDisabled={(option) =>
							(option.value === "follow" || option.value === "bookmarks") &&
							!account.session()
						}
						value={feedOptions().find(
							(option) => option.value === browse.pixivFeed(),
						)}
						onChange={(option) => {
							if (option) browse.selectFeed(option.value);
						}}
						itemComponent={(item) => (
							<SelectItem item={item.item}>
								{item.item.rawValue.label}
							</SelectItem>
						)}
					>
						<SelectTrigger
							class="min-w-0 w-auto gap-2"
							aria-label={t("pixivScreen.feed")}
						>
							<SelectValue<ReturnType<typeof feedOptions>[number]>>
								{(state) => state.selectedOption()?.label}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<ViewerActionsMenu
						siteUrl="https://www.pixiv.net"
						triggerRef={(element) => {
							toolbarTrigger = element;
						}}
						onCloseAutoFocus={openPendingToolbarDialog}
					>
						<DropdownMenuItem
							class="min-h-11"
							disabled={!account.ready()}
							onSelect={() => {
								pendingToolbarDialog = "viewingHistory";
							}}
						>
							<Clock3 aria-hidden="true" size={16} />
							{t("pixivViewingHistory.title")}
						</DropdownMenuItem>
						<DropdownMenuItem
							class="min-h-11"
							disabled={!account.ready()}
							onSelect={() => {
								pendingToolbarDialog = "searchHistory";
							}}
						>
							<Search aria-hidden="true" size={16} />
							{t("viewerSearchHistory.title")}
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							class="min-h-11"
							disabled={!account.ready()}
							onSelect={() => {
								pendingToolbarDialog = "account";
							}}
						>
							<UserRound aria-hidden="true" size={16} />
							{accountLabel()}
						</DropdownMenuItem>
					</ViewerActionsMenu>
				</ClientOnly>
			}
			toolbarContent={
				<>
					<Show when={browse.showingBookmarks() && account.session()}>
						<PixivBookmarkFilters
							filter={browse.bookmarkFilter()}
							scope={account.scope()}
							loadTags={(visibility) =>
								account.transport().viewer.pixivBookmarkTags({ visibility })
							}
							onChange={browse.selectBookmarkFilter}
						/>
					</Show>
					<Dialog
						open={toolbarDialog() === "viewingHistory"}
						onOpenChange={closeToolbarDialog}
					>
						<PixivViewingHistoryContent
							{...viewingHistory}
							onCloseAutoFocus={restoreToolbarFocus}
						/>
					</Dialog>
					<Dialog
						open={toolbarDialog() === "searchHistory"}
						onOpenChange={closeToolbarDialog}
					>
						<ViewerSearchHistoryContent
							entries={searchHistory.entries()}
							onSelect={browse.restoreSearch}
							onClear={searchHistory.clear}
							onCloseAutoFocus={restoreToolbarFocus}
						/>
					</Dialog>
					<PixivAccountDialog
						account={account}
						openPixivLogin={props.openPixivLogin}
						open={toolbarDialog() === "account"}
						onOpenChange={closeToolbarDialog}
						onCloseAutoFocus={restoreToolbarFocus}
					/>
				</>
			}
			renderSearchInfo={(data) => (
				<Show
					when={browse.author()}
					fallback={<PixivSearchInfo data={data} onChoose={browse.choose} />}
				>
					{(author) => (
						<div class="mb-3 flex flex-wrap items-center gap-2">
							<p class="text-sm" aria-live="polite">
								{t("pixivScreen.authorWorks", { name: author().name })}
							</p>
							<Button variant="outline" onClick={() => browse.submit("")}>
								{t("pixivScreen.clearAuthor")}
							</Button>
						</div>
					)}
				</Show>
			)}
			describePost={describePost}
			renderDetail={(navigation, openNewCollection) => (
				<PixivArtworkDetail
					{...navigation}
					query={detail}
					imports={props.imports}
					historyAction={
						<PixivViewingHistoryDialog
							{...viewingHistory}
							ready={account.ready()}
						/>
					}
					bookmarkAction={(id, title) => (
						<Show when={account.session()} keyed>
							{(session) => (
								<PixivBookmarkAction
									id={id}
									title={title}
									scope={account.scope()}
									load={(id) =>
										account.transport().viewer.pixivBookmarkState({ id })
									}
									save={async (change) => {
										const result = await account
											.transport()
											.viewer.setPixivBookmark(change);
										if (
											account.session() === session &&
											browse.showingBookmarks()
										)
											void browse.results.refetch();
										return result;
									}}
								/>
							)}
						</Show>
					)}
					related={(id) => (
						<PixivRelatedWorks
							postId={id}
							history={relatedHistory}
							scope={account.scope()}
							enabled={account.ready()}
							apiBase={props.apiBase()}
							load={(id, ids) =>
								account.transport().viewer.pixivRelatedPage({ id, ids })
							}
							postHref={props.postHref}
							onOpenPost={(id) => props.onOpenPost(id)}
						/>
					)}
					onOpenAuthor={(id, name) => {
						browse.openAuthor(id, name);
						openNewCollection();
					}}
					onSearchTag={(tag) => {
						browse.submit(tag, true);
						openNewCollection();
					}}
					apiBase={props.apiBase}
					readingScope={account.scope()}
					animation={(id) => account.transport().animation(id)}
				/>
			)}
		/>
	);
}
