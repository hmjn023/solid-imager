import type { AppContractClient } from "@solid-imager/core/contract";
import {
	pixivDownloadItem,
	type PixivArtwork,
	type PixivSearchResult,
} from "@solid-imager/core/external-viewer";
import type { DownloadItem } from "@solid-imager/core/media";
import { createQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button, buttonVariants } from "../button";
import { EmptyState, ErrorState } from "../async-state";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "../dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import { MediaViewer, type MediaSource } from "../media-viewer";
import { mediaGridClassName, MediaGridSkeleton } from "../skeleton";
import { DanbooruSearchComposer } from "../danbooru/search-composer";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import { toast } from "../toast";

type PixivProps = {
	client: Pick<AppContractClient, "viewer" | "imports">;
	apiBase: () => string;
	selectedPostId?: number;
	postHref: (id: number) => string;
	onOpenPost: (id: number, replace?: boolean) => void;
	onClosePost: () => void;
};
function imageHref(base: string, url: string) {
	const proxy = new URL("/api/pixiv-image", base);
	proxy.searchParams.set("url", url);
	return proxy.href;
}

function Artwork(props: {
	post: PixivArtwork;
	apiBase: () => string;
	enqueue: (item: DownloadItem) => Promise<unknown>;
}) {
	const [index, setIndex] = createSignal(0);
	const [play, setPlay] = createSignal(false);
	const [pending, setPending] = createSignal(false);
	const [queued, setQueued] = createSignal(new Set<number>());
	const page = () => props.post.pages[index()];
	const item = createMemo(() => pixivDownloadItem(props.post, index()));
	const source = createMemo<MediaSource>(() =>
		play() && props.post.animation
			? {
					type: "video",
					getUrl: () =>
						new URL("/api/pixiv-animation/" + props.post.id, props.apiBase())
							.href,
				}
			: {
					type: "image",
					getUrl: () =>
						imageHref(props.apiBase(), page().original ?? page().preview),
				},
	);
	async function enqueue() {
		const selected = item(),
			pageIndex = index();
		if (!selected || pending() || queued().has(pageIndex)) return;
		setPending(true);
		try {
			await props.enqueue(selected);
			setQueued((ids) => new Set([...ids, pageIndex]));
			toast.success("取り込み待ちに追加しました");
		} catch {
			toast.error("取り込み待ちへの追加に失敗しました");
		} finally {
			setPending(false);
		}
	}
	return (
		<>
			<div class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:flex-row lg:overflow-hidden">
				<div class="flex min-h-64 min-w-0 flex-1 lg:min-h-0">
					<MediaViewer
						source={source()}
						fileName={props.post.title}
						width={page().width}
						height={page().height}
					/>
				</div>
				<aside
					class="w-full shrink-0 space-y-4 p-3 lg:w-80 lg:overflow-y-auto"
					aria-label="作品情報"
				>
					<h2 class="break-words font-semibold">{props.post.title}</h2>
					<p>{props.post.author}</p>
					<p class="text-muted-foreground text-sm">
						{page().width} × {page().height}
					</p>
					<div class="flex flex-wrap gap-2">
						<For each={props.post.tags}>
							{(tag) => <span class="break-all text-sm">{tag}</span>}
						</For>
					</div>
					<Show when={props.post.pages.length > 1}>
						<nav aria-label="作品内のページ" class="flex items-center gap-2">
							<Button
								variant="outline"
								disabled={!index()}
								onClick={() => setIndex((v) => v - 1)}
							>
								前の画像
							</Button>
							<span>
								{index() + 1} / {props.post.pages.length}
							</span>
							<Button
								variant="outline"
								disabled={index() + 1 >= props.post.pages.length}
								onClick={() => setIndex((v) => v + 1)}
							>
								次の画像
							</Button>
						</nav>
					</Show>
					<Show when={props.post.animation && !play()}>
						<Button variant="outline" onClick={() => setPlay(true)}>
							うごイラを再生
						</Button>
					</Show>
					<Show when={props.post.isAnimation && !props.post.animation}>
						<p class="text-muted-foreground text-sm">
							うごイラのフレームデータを取得できませんでした。
						</p>
					</Show>
				</aside>
			</div>
			<div class="flex shrink-0 flex-wrap gap-2 border-t border-border pt-3">
				<a
					href={"https://www.pixiv.net/artworks/" + props.post.id}
					class={buttonVariants({ variant: "outline" })}
					target="_blank"
					rel="noopener noreferrer"
				>
					元の作品 ↗
				</a>
				<Button
					disabled={!item() || pending() || queued().has(index())}
					onClick={() => void enqueue()}
				>
					{queued().has(index())
						? "取り込み待ちに追加済み"
						: pending()
							? "追加中..."
							: props.post.animation
								? "うごイラを取り込み待ちへ"
								: "この画像を取り込み待ちへ"}
				</Button>
			</div>
		</>
	);
}

export function PixivScreen(props: PixivProps) {
	const browse = createViewerSearch<PixivSearchResult>(
		"pixiv",
		async (input, choices) => {
			const result = await props.client.viewer.search({
				...input,
				provider: "pixiv",
				choices,
			});
			if (result.provider !== "pixiv") throw new Error("検索先が一致しません");
			return result;
		},
	);
	const results = browse.results;
	const detail = createQuery(() => ({
		queryKey: ["pixiv", "artwork", props.selectedPostId],
		queryFn: () =>
			props.client.viewer.pixivArtwork({ id: props.selectedPostId ?? 0 }),
		enabled: !!props.selectedPostId,
		retry: false,
		staleTime: 30_000,
	}));
	let trigger: HTMLAnchorElement | undefined;
	const neighbor = (delta: number) => {
		const posts = results.data?.posts ?? [],
			i = posts.findIndex((p) => p.id === props.selectedPostId);
		return i >= 0 ? posts[i + delta] : undefined;
	};
	return (
		<div class="workspace-theme flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
			<header class="shrink-0 space-y-3 border-b border-border p-3 sm:p-4">
				<div class="flex items-baseline justify-between gap-3">
					<h1 class="font-semibold text-xl">pixiv</h1>
					<a
						href="https://www.pixiv.net"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary text-sm hover:underline"
					>
						サイトを開く ↗
					</a>
				</div>
				<DanbooruSearchComposer
					provider="pixiv"
					draft={browse.draft()}
					onDraftChange={browse.setDraft}
					onSubmit={() => browse.submit()}
					suggestTags={(query) => props.client.viewer.suggestTags({ query })}
				/>
			</header>
			<div
				class="@container min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 scrollbar-stable sm:p-4"
				ref={browse.scrollRef}
				onScroll={browse.persist}
			>
				<Show when={results.isPending}>
					<MediaGridSkeleton aspectRatio="4/3" />
				</Show>
				<Show when={results.isError}>
					<ErrorState
						title="pixiv を検索できませんでした"
						description={results.error?.message}
						onRetry={async () => {
							await results.refetch();
						}}
					/>
				</Show>
				<Show when={results.data}>
					{(data) => (
						<>
							<p class="mb-2 text-muted-foreground text-sm" aria-live="polite">
								{data().word
									? "pixiv 検索語 · " + data().word
									: "デイリーランキング"}{" "}
								· {browse.params().page} ページ
							</p>
							<div class="mb-3 flex flex-wrap gap-2">
								<For
									each={data().mappings.filter((row) => row.names.length > 1)}
								>
									{(row) => (
										<div class="flex min-w-0 items-center gap-2">
											<span class="truncate text-sm">{row.tag}</span>
											<Select
												options={row.names}
												value={row.selected}
												onChange={(value) => {
													if (value) browse.choose(row.tag, value);
												}}
												itemComponent={(item) => (
													<SelectItem item={item.item}>
														{item.item.rawValue}
													</SelectItem>
												)}
											>
												<SelectTrigger aria-label={row.tag + " の pixiv タグ"}>
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
							<Show
								when={data().posts.length}
								fallback={
									<EmptyState
										title="該当する作品がありません"
										description="タグを変更して検索してください。"
									/>
								}
							>
								<div class={mediaGridClassName}>
									<For each={data().posts}>
										{(post, i) => (
											<a
												href={props.postHref(post.id)}
												class="relative aspect-landscape overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
												aria-label={post.title + " を開く"}
												onClick={(event) => {
													if (
														!event.ctrlKey &&
														!event.metaKey &&
														!event.shiftKey &&
														!event.altKey &&
														event.button === 0
													) {
														event.preventDefault();
														trigger = event.currentTarget;
														props.onOpenPost(post.id);
													}
												}}
											>
												<Show when={post.thumbnail}>
													{(url) => (
														<img
															src={imageHref(props.apiBase(), url())}
															alt={post.title}
															class="h-full w-full object-cover"
															loading={i() < 2 ? "eager" : "lazy"}
															fetchpriority={i() < 2 ? "high" : undefined}
														/>
													)}
												</Show>
												<span class="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-white text-xs">
													{post.title} · {post.pageCount}枚
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
				class="flex shrink-0 items-center justify-center gap-3 border-t border-border p-3"
				aria-label="pixiv のページ"
			>
				<Button
					variant="outline"
					disabled={browse.params().page <= 1 || results.isFetching}
					onClick={() => browse.changePage(browse.params().page - 1)}
				>
					前のページ
				</Button>
				<span>{browse.params().page}</span>
				<Button
					variant="outline"
					disabled={!results.data?.hasNextPage || results.isFetching}
					onClick={() => browse.changePage(browse.params().page + 1)}
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
						trigger?.focus({ preventScroll: true });
					}}
				>
					<div class="flex shrink-0 flex-wrap items-center gap-2 pr-8">
						<DialogTitle>pixiv #{props.selectedPostId}</DialogTitle>
						<DialogDescription class="sr-only">
							作品の画像とタグ
						</DialogDescription>
						<Button
							variant="outline"
							size="sm"
							disabled={!neighbor(-1)}
							onClick={() => {
								const post = neighbor(-1);
								if (post) props.onOpenPost(post.id, true);
							}}
						>
							前の作品
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!neighbor(1)}
							onClick={() => {
								const post = neighbor(1);
								if (post) props.onOpenPost(post.id, true);
							}}
						>
							次の作品
						</Button>
					</div>
					<Show when={detail.isPending}>
						<output>作品を読み込み中...</output>
					</Show>
					<Show when={detail.isError}>
						<ErrorState
							title="作品を取得できませんでした"
							description={detail.error?.message}
							onRetry={async () => {
								await detail.refetch();
							}}
						/>
					</Show>
					<Show
						keyed
						when={detail.data?.id === props.selectedPostId && detail.data}
					>
						{(post) => (
							<Artwork
								post={post}
								apiBase={props.apiBase}
								enqueue={(item) =>
									props.client.imports.bulkAdd({ items: [item] })
								}
							/>
						)}
					</Show>
				</DialogContent>
			</Dialog>
		</div>
	);
}
