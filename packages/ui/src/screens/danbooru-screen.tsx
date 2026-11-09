import {
	danbooruPostToDownloadItem,
	getDanbooruPostUrl,
	getDanbooruPreview,
	type DanbooruPost,
	type DanbooruSearchResult,
} from "@solid-imager/core/danbooru";
import type { DownloadItem } from "@solid-imager/core/media";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show } from "solid-js";
import type {
	ExternalSearch,
	ViewerTag,
} from "@solid-imager/core/external-viewer";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import { EmptyState, ErrorState } from "../async-state";
import { Button, buttonVariants } from "../button";
import { DanbooruSearchComposer } from "../danbooru/search-composer";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "../dialog";
import { MediaViewer, type MediaSource } from "../media-viewer";
import { MediaGridSkeleton, mediaGridClassName } from "../skeleton";
import { toast } from "../toast";

const ratingLabels: Record<string, string> = {
	g: "General",
	s: "Sensitive",
	q: "Questionable",
	e: "Explicit",
};
const tagGroups = [
	["artist", "作者"],
	["copyright", "作品"],
	["character", "キャラクター"],
	["general", "タグ"],
	["meta", "メタ"],
] as const;

export type DanbooruScreenProps = {
	search: (input: ExternalSearch) => Promise<DanbooruSearchResult>;
	getPost: (id: number) => Promise<DanbooruPost>;
	suggestTags: (query: string) => Promise<ViewerTag[]>;
	enqueueImport: (item: DownloadItem) => Promise<unknown>;
	selectedPostId?: number;
	onOpenPost: (id: number, replace?: boolean) => void;
	onClosePost: () => void;
	postHref: (id: number) => string;
};

/** Remote browsing deliberately keeps its query separate from local library filters. */
export function DanbooruScreen(props: DanbooruScreenProps) {
	const {
		params,
		draft,
		setDraft,
		results,
		changePage,
		persist,
		scrollRef,
		submit,
	} = createViewerSearch("danbooru", props.search);
	const [addingId, setAddingId] = createSignal<number | null>(null);
	const [queuedIds, setQueuedIds] = createSignal(new Set<number>());
	let lastTrigger: HTMLAnchorElement | undefined;
	const detail = createQuery(() => ({
		queryKey: ["danbooru", "post", props.selectedPostId],
		queryFn: () => props.getPost(props.selectedPostId ?? 0),
		enabled: !!props.selectedPostId,
		staleTime: 30_000,
		retry: false,
		initialData: () =>
			results.data?.posts.find((post) => post.id === props.selectedPostId),
	}));
	const selected = () =>
		detail.data?.id === props.selectedPostId ? detail.data : undefined;
	const media = createMemo<MediaSource | null>(() => {
		const post = selected();
		if (!post) return null;
		const preview = getDanbooruPreview(post);
		return preview ? { type: preview.type, getUrl: () => preview.url } : null;
	});
	const search = (tags = draft()) => {
		submit(tags);
		if (props.selectedPostId) props.onClosePost();
	};
	const addImport = async (post: DanbooruPost) => {
		const item = danbooruPostToDownloadItem(post);
		if (!item || addingId() !== null || queuedIds().has(post.id)) return;
		setAddingId(post.id);
		try {
			await props.enqueueImport(item);
			setQueuedIds((current) => new Set([...current, post.id]));
			toast.success("取り込み待ちに追加しました", {
				description: "サイドバーの取り込み待ちから保存先を選んで取り込めます。",
			});
		} catch (error) {
			toast.error("取り込み待ちへの追加に失敗しました", {
				description:
					error instanceof Error ? error.message : "再試行してください。",
			});
		} finally {
			setAddingId(null);
		}
	};
	const adjacent = (offset: number) => {
		const posts = results.data?.posts ?? [];
		const index = posts.findIndex((post) => post.id === props.selectedPostId);
		return index >= 0 ? posts[index + offset] : undefined;
	};

	return (
		<div class="workspace-theme flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
			<header class="shrink-0 space-y-3 border-b border-border p-3 sm:p-4">
				<div class="flex items-baseline justify-between gap-3">
					<h1 class="font-semibold text-xl">Danbooru</h1>
					<a
						class="text-primary text-sm underline-offset-4 hover:underline"
						href="https://danbooru.donmai.us"
						target="_blank"
						rel="noopener noreferrer"
					>
						サイトを開く ↗
					</a>
				</div>
				<DanbooruSearchComposer
					draft={draft()}
					onDraftChange={setDraft}
					onSubmit={() => search()}
					suggestTags={props.suggestTags}
				/>
			</header>
			<div
				class="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 scrollbar-stable sm:p-4"
				ref={scrollRef}
				onScroll={persist}
			>
				<Show when={results.isPending}>
					<div aria-live="polite" aria-busy="true">
						<span class="sr-only">投稿を読み込み中</span>
						<MediaGridSkeleton aspectRatio="4/3" />
					</div>
				</Show>
				<Show when={results.isError}>
					<ErrorState
						title="Danbooru を取得できませんでした"
						description={
							results.error instanceof Error
								? results.error.message
								: "接続を確認して再試行してください。"
						}
						onRetry={async () => {
							await results.refetch();
						}}
					/>
				</Show>
				<Show when={results.data}>
					{(data) => (
						<>
							<p class="mb-3 text-muted-foreground text-sm" aria-live="polite">
								{params().page} ページ · {data().posts.length} 件
							</p>
							<Show
								when={data().posts.length > 0}
								fallback={
									<EmptyState
										title="該当する投稿がありません"
										description="タグを変更して検索してください。"
									/>
								}
							>
								<div class={mediaGridClassName}>
									<For each={data().posts}>
										{(post, index) => (
											<a
												aria-label={`Danbooru #${post.id} を開く`}
												class="group relative aspect-landscape min-w-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
												href={props.postHref(post.id)}
												data-danbooru-post-id={post.id}
												onClick={(event) => {
													if (
														!event.ctrlKey &&
														!event.metaKey &&
														!event.shiftKey &&
														!event.altKey &&
														event.button === 0
													) {
														event.preventDefault();
														lastTrigger = event.currentTarget;
														props.onOpenPost(post.id);
													}
												}}
											>
												<Show
													when={post.previewUrl}
													fallback={
														<span class="flex h-full items-center justify-center text-muted-foreground text-xs">
															プレビューなし
														</span>
													}
												>
													{(url) => (
														<img
															alt={`Danbooru #${post.id}`}
															class="h-full w-full object-cover"
															src={url()}
															width={post.width || undefined}
															height={post.height || undefined}
															loading={index() < 2 ? "eager" : "lazy"}
															fetchpriority={index() < 2 ? "high" : undefined}
															referrerpolicy="no-referrer"
														/>
													)}
												</Show>
												<span class="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/70 px-2 py-1 text-white text-xs">
													<span>#{post.id}</span>
													<span>
														{post.fileExt.toUpperCase()} ·{" "}
														{ratingLabels[post.rating] ?? post.rating}
													</span>
												</span>
											</a>
										)}
									</For>
								</div>
							</Show>
						</>
					)}
				</Show>
			</div>
			<nav
				aria-label="Danbooru のページ"
				class="flex shrink-0 items-center justify-center gap-3 border-t border-border p-3"
			>
				<Button
					variant="outline"
					disabled={params().page <= 1 || results.isFetching}
					onClick={() => changePage(params().page - 1)}
				>
					前のページ
				</Button>
				<span class="text-sm">{params().page}</span>
				<Button
					variant="outline"
					disabled={!results.data?.hasNextPage || results.isFetching}
					onClick={() => changePage(params().page + 1)}
				>
					次のページ
				</Button>
			</nav>
			<Dialog
				open={!!props.selectedPostId}
				onOpenChange={(open) => {
					if (!open && props.selectedPostId) props.onClosePost();
				}}
			>
				<DialogContent
					class="workspace-theme flex h-dialog-screen max-h-dialog-safe w-dialog-inset max-w-none flex-col gap-3 overflow-hidden p-3 sm:p-4"
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						lastTrigger?.focus({ preventScroll: true });
					}}
				>
					<div class="shrink-0 pr-8">
						<DialogTitle>Danbooru #{props.selectedPostId}</DialogTitle>
						<DialogDescription>
							作品を閲覧し、画像をライブラリの取り込み待ちへ追加できます。
						</DialogDescription>
					</div>
					<Show when={detail.isPending}>
						<output>投稿を読み込み中...</output>
					</Show>
					<Show when={detail.isError}>
						<ErrorState
							title="投稿を取得できませんでした"
							description={
								detail.error instanceof Error
									? detail.error.message
									: "再試行してください。"
							}
							onRetry={async () => {
								await detail.refetch();
							}}
						/>
					</Show>
					<Show when={selected()}>
						{(post) => (
							<>
								<div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">
									<div class="flex min-h-64 min-w-0 flex-1 lg:min-h-0">
										<Show
											when={media()}
											fallback={
												<EmptyState
													title="この投稿のプレビューは利用できません"
													description="公開範囲またはファイル形式により表示できません。元サイトで確認できます。"
												/>
											}
										>
											{(source) => (
												<MediaViewer
													source={source()}
													fileName={`Danbooru #${post().id}`}
													width={post().width}
													height={post().height}
												/>
											)}
										</Show>
									</div>
									<aside
										aria-label="投稿情報"
										class="w-full shrink-0 space-y-4 p-3 lg:w-80 lg:overflow-y-auto"
									>
										<p class="text-muted-foreground text-sm">
											{post().width} × {post().height} ·{" "}
											{post().fileExt.toUpperCase()} ·{" "}
											{ratingLabels[post().rating] ?? post().rating} · Score{" "}
											{post().score}
										</p>
										<For each={tagGroups}>
											{([key, label]) => (
												<Show when={post().tags[key].length > 0}>
													<section>
														<h2 class="mb-1 font-semibold text-sm">{label}</h2>
														<div class="flex flex-wrap gap-1">
															<For each={post().tags[key]}>
																{(tag) => (
																	<Button
																		class="h-auto min-h-9 max-w-full whitespace-normal break-all px-2 py-1 text-left text-xs"
																		variant="ghost"
																		onClick={() => search(tag)}
																	>
																		{tag}
																	</Button>
																)}
															</For>
														</div>
													</section>
												</Show>
											)}
										</For>
									</aside>
								</div>
								<div class="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-3">
									<Button
										aria-label="前の投稿"
										variant="outline"
										disabled={!adjacent(-1)}
										onClick={() => {
											const previous = adjacent(-1);
											if (previous) props.onOpenPost(previous.id, true);
										}}
									>
										← 前
									</Button>
									<Button
										aria-label="次の投稿"
										variant="outline"
										disabled={!adjacent(1)}
										onClick={() => {
											const next = adjacent(1);
											if (next) props.onOpenPost(next.id, true);
										}}
									>
										次 →
									</Button>
									<a
										class={buttonVariants({ variant: "outline" })}
										href={getDanbooruPostUrl(post().id)}
										target="_blank"
										rel="noopener noreferrer"
									>
										元の投稿 ↗
									</a>
									<Button
										disabled={
											addingId() !== null ||
											queuedIds().has(post().id) ||
											!danbooruPostToDownloadItem(post())
										}
										aria-busy={addingId() === post().id}
										onClick={() => void addImport(post())}
									>
										{queuedIds().has(post().id)
											? "取り込み待ちに追加済み"
											: addingId() === post().id
												? "追加中..."
												: "画像を取り込み待ちへ"}
									</Button>
									<Show when={!danbooruPostToDownloadItem(post())}>
										<p class="text-muted-foreground text-xs">
											原本を取得できない投稿や、画像以外の取り込みには対応していません。
										</p>
									</Show>
								</div>
							</>
						)}
					</Show>
				</DialogContent>
			</Dialog>
		</div>
	);
}
