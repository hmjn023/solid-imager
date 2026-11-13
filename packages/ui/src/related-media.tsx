import { t } from "@solid-imager/i18n";
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
	similar: t("relatedMedia.similarImages"),
	character: t("relatedMedia.sameCharacter"),
	ip: t("relatedMedia.sameIP"),
	tag: t("relatedMedia.similarTags"),
};

const categories = [
	{
		value: "all",
		label: t("relatedMedia.recommended"),
		empty: t("relatedMedia.noRelatedMediaYet"),
	},
	{
		value: "similar",
		label: t("relatedMedia.similarImages"),
		empty: t("relatedMedia.noSimilarImagesFound"),
	},
	{
		value: "character",
		label: t("relatedMedia.sameCharacter"),
		empty: t("relatedMedia.noImagesWithTheSameCharacter"),
	},
	{
		value: "ip",
		label: t("relatedMedia.sameIP"),
		empty: t("relatedMedia.noImagesWithTheSameIP"),
	},
	{
		value: "tag",
		label: t("relatedMedia.similarTags"),
		empty: t("relatedMedia.noImagesWithSimilarTags"),
	},
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
		<LoadingRegion label={t("relatedMedia.loadingRelatedMedia")}>
			<MediaGridSkeleton aspectRatio="4/3" count={12} />
		</LoadingRegion>
	);
}

/** Supplementary recommendations load independently from the main media preview. */
export function RelatedMedia(props: RelatedMediaProps) {
	return (
		<section
			aria-label={t("relatedMedia.relatedMedia")}
			class="@container min-w-0 space-y-3 border-border border-t p-3 sm:p-4"
		>
			<h2 class="font-semibold text-base">{t("relatedMedia.relatedMedia")}</h2>
			<Suspense fallback={<RelatedMediaPending />}>
				<RelatedMediaContent {...props} />
			</Suspense>
		</section>
	);
}

/**
 * Restores the browser's seed before querying and keeps displayed recommendations
 * separate from an attempted refresh so loading or failure cannot clear them.
 */
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
	/**
	 * Commits a new seed only after fetching succeeds; retries reuse the failed seed.
	 * Results from an unmounted view, another media item or an older attempt are ignored.
	 */
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
		if (
			props.media.mediaType !== "image" &&
			props.media.mediaType !== "video"
		) {
			return t("relatedMedia.visualSimilarityIsAvailableForImagesAndVideo");
		}
		if (query.data?.similarityStatus === "not_indexed") {
			return t(
				"relatedMedia.similarRecommendationsRequireAnImageSearchIndexForThis",
			);
		}
		if (query.data?.similarityStatus === "unavailable") {
			return t("relatedMedia.couldNotLoadSimilarImagesCharacterIPAndTag");
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
					description={t(
						"relatedMedia.reloadRelatedMediaWhenYourConnectionReturns",
					)}
					onRetry={retry}
					retryLabel={t("relatedMedia.reloadRelatedMedia")}
				/>
			</Match>
			<Match when={state().phase === "error"}>
				<ErrorState
					description={t("relatedMedia.pleaseTryAgainLater")}
					onRetry={retry}
					retryLabel={t("relatedMedia.reloadRelatedMedia")}
					title={t("relatedMedia.couldNotLoadRelatedMedia")}
				/>
			</Match>
			<Match when={state().data !== undefined}>
				<div class="space-y-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-muted-foreground text-xs">
							{t(
								"relatedMedia.recommendationsByVisualStyleCharactersIPsAndTags",
							)}
						</p>
						<Button
							aria-label={t("relatedMedia.reloadRelatedMedia")}
							aria-busy={query.isFetching || isRefreshing()}
							class="min-h-11 shrink-0 sm:min-h-9"
							disabled={query.isFetching || isRefreshing()}
							onClick={() => void refresh()}
							size="sm"
							variant="ghost"
						>
							{t("relatedMedia.otherRecommendations")}
						</Button>
					</div>
					<QueryStatus
						errorLabel={t("relatedMedia.couldNotRefreshRelatedMedia")}
						fetchState={
							isRefreshing() ? "background-fetching" : state().fetchState
						}
						hasData
						hasError={query.isError}
						hideWhenIdle
						offlineLabel={t("relatedMedia.offlineShowingSavedRecommendations")}
						updatingLabel={t("relatedMedia.updatingRelatedMedia")}
					/>
					<Show when={activeAttempt()?.status === "error"}>
						<ErrorState
							description={t(
								"relatedMedia.showingPreviousRecommendationsYouCanReloadThem",
							)}
							onRetry={() => refresh(activeAttempt()?.seed)}
							retryLabel={t("relatedMedia.reloadRelatedMedia")}
							title={t("relatedMedia.couldNotRefreshRelatedMedia")}
						/>
					</Show>
					<Show when={activeAttempt()?.status === "offline"}>
						<OfflineState
							description={t(
								"relatedMedia.showingPreviousRecommendationsReloadThemWhenYourConnectionReturns",
							)}
							onRetry={() => refresh(activeAttempt()?.seed)}
							retryLabel={t("relatedMedia.reloadRelatedMedia")}
						/>
					</Show>
					<Tabs defaultValue="all">
						<div class="overflow-x-auto pb-1">
							<TabsList
								aria-label={t("relatedMedia.relatedMediaCategories")}
								class="max-w-none"
							>
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
