import type {
	MediaSafe,
	RelatedMediaReason,
	RelatedMediaResponse,
} from "@solid-imager/core/media";
import {
	createQuery,
	onlineManager,
	useQueryClient,
	type QueryOptions,
} from "@tanstack/solid-query";
import {
	createMemo,
	createEffect,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	on,
	Show,
	Suspense,
	Switch,
	type JSX,
} from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "./async-state";
import { Button } from "./button";
import { MediaGridItem, type MediaGridThumbnailProps } from "./media-grid-item";
import { MediaGridItemLink } from "./media-grid-item-link";
import { toQueryUiState } from "./query-state";
import {
	createRelatedMediaSeed,
	getBrowserRelatedMediaSeedStore,
} from "./related-media-seeds";
import {
	LoadingRegion,
	mediaGridClassName,
	MediaGridSkeleton,
} from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const reasonLabels: Record<RelatedMediaReason, string> = {
	similar: "似た画像",
	character: "同じキャラ",
	ip: "同じIP",
	tag: "タグが近い",
};

const categories = [
	{ value: "all", label: "おすすめ", empty: "関連メディアがまだありません" },
	{
		value: "similar",
		label: "似た画像",
		empty: "似た画像が見つかりませんでした",
	},
	{
		value: "character",
		label: "同じキャラ",
		empty: "同じキャラの画像がありません",
	},
	{ value: "ip", label: "同じIP", empty: "同じIPの画像がありません" },
	{ value: "tag", label: "タグが近い", empty: "タグが近い画像がありません" },
] as const;

export type RelatedMediaProps = {
	media: Pick<MediaSafe, "id" | "mediaSourceId" | "mediaType">;
	queryOptions: (
		sourceId: string,
		mediaId: string,
		seed: string,
	) => QueryOptions<RelatedMediaResponse> & { initialData?: undefined };
	renderThumbnail: (props: MediaGridThumbnailProps<MediaSafe>) => JSX.Element;
};

function RelatedMediaPending() {
	return (
		<LoadingRegion label="関連メディアを読み込んでいます...">
			<MediaGridSkeleton aspectRatio="4/3" count={12} />
		</LoadingRegion>
	);
}

/** Supplementary recommendations load independently from the main media preview. */
export function RelatedMedia(props: RelatedMediaProps) {
	return (
		<section
			aria-label="関連メディア"
			class="@container min-w-0 space-y-3 border-border border-t p-3 sm:p-4"
		>
			<h2 class="font-semibold text-base">関連メディア</h2>
			<Suspense fallback={<RelatedMediaPending />}>
				<RelatedMediaContent {...props} />
			</Suspense>
		</section>
	);
}

function RelatedMediaContent(props: RelatedMediaProps) {
	const queryClient = useQueryClient();
	const [seedStore, setSeedStore] =
		createSignal<ReturnType<typeof getBrowserRelatedMediaSeedStore>>();
	const [seedRevision, setSeedRevision] = createSignal(0);
	const [refreshAttempt, setRefreshAttempt] = createSignal<{
		anchor: string;
		seed: string;
		status: "pending" | "error" | "offline";
	}>();
	const anchor = () => `${props.media.mediaSourceId}/${props.media.id}`;
	createEffect(on(anchor, () => setRefreshAttempt(undefined), { defer: true }));
	const seed = createMemo(() => {
		seedRevision();
		return seedStore()?.get(props.media.mediaSourceId, props.media.id);
	});
	let mounted = true;
	onCleanup(() => {
		mounted = false;
	});
	onMount(() => setSeedStore(getBrowserRelatedMediaSeedStore(window)));
	const query = createQuery<RelatedMediaResponse>(() => ({
		...props.queryOptions(
			props.media.mediaSourceId,
			props.media.id,
			seed() ?? "default",
		),
		enabled: seed() !== undefined,
	}));
	const state = () => toQueryUiState(query);
	const retry = () => query.refetch().then(() => undefined);
	const activeAttempt = () =>
		refreshAttempt()?.anchor === anchor() ? refreshAttempt() : undefined;
	const isRefreshing = () => activeAttempt()?.status === "pending";
	const refresh = async (retrySeed?: string) => {
		if (isRefreshing()) return;
		const sourceId = props.media.mediaSourceId;
		const mediaId = props.media.id;
		const attempt = {
			anchor: anchor(),
			seed: retrySeed ?? createRelatedMediaSeed(),
		};
		if (!onlineManager.isOnline()) {
			setRefreshAttempt({ ...attempt, status: "offline" });
			return;
		}
		setRefreshAttempt({ ...attempt, status: "pending" });
		try {
			// Commit the new seed only after success, retaining the current tiles and tab
			// throughout loading, errors and offline recovery.
			await queryClient.query(
				props.queryOptions(sourceId, mediaId, attempt.seed),
			);
			if (
				!mounted ||
				anchor() !== attempt.anchor ||
				refreshAttempt()?.seed !== attempt.seed
			)
				return;
			seedStore()?.save(sourceId, mediaId, attempt.seed);
			setSeedRevision((revision) => revision + 1);
			setRefreshAttempt(undefined);
		} catch {
			if (
				mounted &&
				anchor() === attempt.anchor &&
				refreshAttempt()?.seed === attempt.seed
			) {
				setRefreshAttempt({
					...attempt,
					status: onlineManager.isOnline() ? "error" : "offline",
				});
			}
		}
	};
	const similarityMessage = () => {
		if (props.media.mediaType !== "image") {
			return "似た画像のおすすめは画像メディアで利用できます。";
		}
		if (query.data?.similarityStatus === "not_indexed") {
			return "似た画像のおすすめには、この画像の画像検索インデックスが必要です。画像の操作メニューやManagerで作成できます。";
		}
		if (query.data?.similarityStatus === "unavailable") {
			return "似た画像を取得できませんでした。キャラ・IP・タグの候補は引き続き表示できます。";
		}
		return undefined;
	};

	return (
		<Switch>
			<Match when={state().phase === "pending"}>
				<RelatedMediaPending />
			</Match>
			<Match when={state().phase === "offline"}>
				<OfflineState
					description="接続が戻ったら関連メディアを再取得できます。"
					onRetry={retry}
					retryLabel="関連メディアを再取得"
				/>
			</Match>
			<Match when={state().phase === "error"}>
				<ErrorState
					description="時間をおいて、もう一度お試しください。"
					onRetry={retry}
					retryLabel="関連メディアを再取得"
					title="関連メディアを読み込めませんでした"
				/>
			</Match>
			<Match when={state().data !== undefined}>
				<div class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-muted-foreground text-xs">
							画像の雰囲気・キャラ・IP・タグからおすすめ
						</p>
						<Button
							aria-label="関連メディアを再取得"
							aria-busy={query.isFetching || isRefreshing()}
							class="min-h-11 shrink-0 sm:min-h-9"
							disabled={query.isFetching || isRefreshing()}
							onClick={() => void refresh()}
							size="sm"
							variant="ghost"
						>
							別のおすすめ
						</Button>
					</div>
					<QueryStatus
						errorLabel="関連メディアを更新できませんでした"
						fetchState={
							isRefreshing() ? "background-fetching" : state().fetchState
						}
						hasData
						hasError={query.isError}
						hideWhenIdle
						offlineLabel="オフラインのため保存済みの候補を表示しています"
						updatingLabel="関連メディアを更新しています..."
					/>
					<Show when={activeAttempt()?.status === "error"}>
						<ErrorState
							description="前の候補を表示しています。もう一度取得できます。"
							onRetry={() => refresh(activeAttempt()?.seed)}
							retryLabel="関連メディアを再取得"
							title="関連メディアを更新できませんでした"
						/>
					</Show>
					<Show when={activeAttempt()?.status === "offline"}>
						<OfflineState
							description="前の候補を表示しています。接続が戻ったら再取得できます。"
							onRetry={() => refresh(activeAttempt()?.seed)}
							retryLabel="関連メディアを再取得"
						/>
					</Show>
					<Tabs defaultValue="all">
						<div class="overflow-x-auto pb-1">
							<TabsList aria-label="関連メディアの種類" class="max-w-none">
								<For each={categories}>
									{(category) => (
										<TabsTrigger
											class="min-h-11 sm:min-h-9"
											value={category.value}
										>
											{category.label}
										</TabsTrigger>
									)}
								</For>
							</TabsList>
						</div>
						<For each={categories}>
							{(category) => {
								const items = () =>
									category.value === "all"
										? (query.data?.recommendations ?? [])
										: (query.data?.items.filter((item) =>
												item.reasons.includes(category.value),
											) ?? []);
								return (
									<TabsContent class="space-y-3" value={category.value}>
										<Show
											when={
												(category.value === "all" ||
													category.value === "similar") &&
												similarityMessage()
											}
										>
											{(message) => (
												<p class="text-muted-foreground text-xs">{message()}</p>
											)}
										</Show>
										<Show
											fallback={
												<p class="py-6 text-muted-foreground text-sm">
													{category.empty}
												</p>
											}
											when={items().length > 0}
										>
											<div class={mediaGridClassName}>
												<For each={items()}>
													{(item) => (
														<div class="min-w-0 space-y-1">
															<MediaGridItem
																media={item.media}
																linkComponent={(linkProps) => (
																	<MediaGridItemLink
																		linkProps={linkProps}
																		media={item.media}
																		relatedFrom={props.media}
																	>
																		{linkProps.children}
																	</MediaGridItemLink>
																)}
																renderThumbnail={props.renderThumbnail}
															/>
															<p class="text-muted-foreground text-xs">
																{item.reasons
																	.map((reason) => reasonLabels[reason])
																	.join("・")}
															</p>
														</div>
													)}
												</For>
											</div>
										</Show>
									</TabsContent>
								);
							}}
						</For>
					</Tabs>
				</div>
			</Match>
		</Switch>
	);
}
