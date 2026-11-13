import { t } from "@solid-imager/i18n";
import type {
	ClusteringGroupsRequest,
	ClusteringGroupsResponse,
	ClusteringMediaRequest,
	ClusteringMediaResponse,
	ClusteringReviewMedia,
	ClusteringRunSummary,
	StartCharacterClustering,
} from "@solid-imager/core/characters";
import { createInfiniteQuery, createQuery } from "@tanstack/solid-query";
import {
	batch,
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
} from "solid-js";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
} from "../../async-state";
import { Badge } from "../../badge";
import { Button } from "../../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "../../select";
import { Skeleton } from "../../skeleton";
import { ManagedThumbnailImage } from "../../managed-thumbnail-image";
import { TextField, TextFieldInput, TextFieldLabel } from "../../text-field";

import { ClusteringVirtualGrid } from "./clustering-virtual-grid";
import { CharacterClusteringStart } from "./character-clustering-start";

export type CharacterClusteringReviewActions = {
	startClustering?: (
		input: StartCharacterClustering,
	) => Promise<{ jobId: string }>;
	openJobs?: () => void;
	openMedia: (media: ClusteringReviewMedia) => void;
	listRuns: () => Promise<ClusteringRunSummary[]>;
	listGroups: (
		input: ClusteringGroupsRequest,
	) => Promise<ClusteringGroupsResponse>;
	listMedia: (
		input: ClusteringMediaRequest,
	) => Promise<ClusteringMediaResponse>;
	thumbnailUrl: (
		sourceId: string,
		mediaId: string,
		modifiedAt: string,
	) => string | Promise<string>;
	releaseThumbnailUrl?: (url: string) => void;
};

const PAGE = 24;
const IMAGES = 48;
const PREFERENCE = "solid-imager:character-clustering";
function readPreference(name: string): string {
	try {
		return typeof sessionStorage === "undefined"
			? ""
			: (sessionStorage.getItem(`${PREFERENCE}:${name}`) ?? "");
	} catch {
		return "";
	}
}
function writePreference(name: string, value: string): void {
	try {
		if (typeof sessionStorage !== "undefined")
			sessionStorage.setItem(`${PREFERENCE}:${name}`, value);
	} catch {
		/* Storage can be disabled. */
	}
}
function title(run: ClusteringRunSummary): string {
	const p = run.parameters;
	return t(
		"characterClustering.valueMinimumValueImagesDensityValueNeighborsValueValue",
		{
			value0: String(run.name.split("/").at(-1)),
			value1: String(p.minClusterSize),
			value2: String(p.minSamples),
			value3: String(p.neighbors),
			value4: String(p.selectionMethod),
		},
	);
}

function Thumbnail(props: {
	src: string | Promise<string>;
	alt: string;
	eager?: boolean;
	releaseUrl?: (url: string) => void;
}) {
	return (
		<div class="relative aspect-4/3 min-w-0 overflow-hidden rounded-md">
			<ManagedThumbnailImage
				alt={props.alt}
				class="h-full w-full object-contain"
				fallback={t("characterClustering.couldNotLoadImages")}
				fetchpriority={props.eager ? "high" : undefined}
				height={256}
				loading={props.eager ? "eager" : "lazy"}
				src={props.src}
				releaseUrl={props.releaseUrl}
				width={256}
			/>
		</div>
	);
}

function Continuation(props: {
	loaded: number;
	total: number;
	loading: boolean;
	hasMore: boolean;
	failed: boolean;
	paused: boolean;
	onLoad: () => void;
}) {
	return (
		<div class="space-y-3 border-t pt-3">
			<p aria-live="polite" class="text-sm text-muted-foreground">
				{t("characterClustering.loadedValueValueValueItems", {
					value0: String(props.loaded.toLocaleString()),
					value2: String(props.total.toLocaleString()),
				})}
			</p>
			<Show when={props.failed}>
				<ErrorState
					title={t("characterClustering.couldNotLoadMore")}
					onRetry={props.onLoad}
				/>
			</Show>
			<Show when={props.hasMore && !props.failed}>
				<Button
					disabled={props.loading || props.paused}
					onClick={props.onLoad}
					variant="outline"
				>
					{props.loading
						? t("characterClustering.loadingMore")
						: t("actions.loadMore")}
				</Button>
			</Show>
		</div>
	);
}

function ImageGrid(props: {
	resetKey: string;
	total: number;
	canLoadMore: boolean;
	onLoadMore: () => void;
	label: string;
	media: ClusteringReviewMedia[];
	actions: CharacterClusteringReviewActions;
	comparing: boolean;
	large: boolean;
	onFollow: (cluster: number) => void;
}) {
	return (
		<ClusteringVirtualGrid
			items={props.media}
			itemKey={(image) => image.id}
			label={props.label}
			layout={props.large ? "large-images" : "images"}
			resetKey={props.resetKey}
			total={props.total}
			canLoadMore={props.canLoadMore}
			onLoadMore={props.onLoadMore}
		>
			{(media, index) => (
				<article class="min-w-0 space-y-1">
					<a
						aria-label={t("characterClustering.openValue", {
							value0: String(media.fileName),
						})}
						class="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
						href={`/sources/${media.mediaSourceId}/${media.id}`}
						onClick={(event) => {
							if (
								event.defaultPrevented ||
								event.button !== 0 ||
								event.metaKey ||
								event.ctrlKey ||
								event.shiftKey ||
								event.altKey
							)
								return;
							event.preventDefault();
							props.actions.openMedia(media);
						}}
					>
						<Thumbnail
							releaseUrl={props.actions.releaseThumbnailUrl}
							alt={media.fileName}
							eager={index === 0}
							src={props.actions.thumbnailUrl(
								media.mediaSourceId,
								media.id,
								media.modifiedAt,
							)}
						/>
					</a>
					<p class="truncate text-xs" title={media.fileName}>
						{media.fileName}
					</p>
					<p class="truncate text-xs text-muted-foreground">
						{media.characters.map((character) => character.name).join("、") ||
							t("characterClustering.noExistingLabels")}
					</p>
					<Show when={media.clusterId >= 0}>
						<p class="text-xs text-muted-foreground">
							{t("characterClustering.membershipStrengthValue", {
								value0: String(Math.round(media.membershipStrength * 100)),
							})}
						</p>
					</Show>
					<Show when={props.comparing}>
						<Show
							when={media.comparisonClusterId !== null}
							fallback={
								<span class="text-xs text-muted-foreground">
									{t("characterClustering.notIncludedInTheComparison")}
								</span>
							}
						>
							<Button
								class="h-auto min-h-11 sm:min-h-8 max-w-full whitespace-normal px-1 text-left text-xs"
								onClick={() => {
									if (media.comparisonClusterId !== null)
										props.onFollow(media.comparisonClusterId);
								}}
								variant="link"
							>
								{t("characterClustering.comparisonValueValue", {
									value1: String(
										media.comparisonClusterId === -1
											? t("characterClustering.noise")
											: t("characterClustering.groupValue", {
													value0: String(media.comparisonClusterId),
												}),
									),
								})}
							</Button>
						</Show>
					</Show>
				</article>
			)}
		</ClusteringVirtualGrid>
	);
}

export function CharacterClusteringReviewPanel(props: {
	actions: CharacterClusteringReviewActions;
}) {
	const [chosenRun, setChosenRun] = createSignal(readPreference("run"));
	const [chosenComparison, setChosenComparison] = createSignal(
		readPreference("comparison"),
	);
	const [view, setView] = createSignal(
		readPreference("view") === "noise" ? "noise" : "groups",
	);
	const [query, setQuery] = createSignal("");
	const [appliedQuery, setAppliedQuery] = createSignal("");
	const [sort, setSort] = createSignal<ClusteringGroupsRequest["sort"]>("size");
	const [detailId, setDetailId] = createSignal<number | null>(null);
	const [detailOrder, setDetailOrder] =
		createSignal<ClusteringMediaRequest["order"]>("weak");
	const [large, setLarge] = createSignal(false);
	const runs = createQuery(() => ({
		queryKey: ["character-clustering", "runs"],
		queryFn: props.actions.listRuns,
		staleTime: 30_000,
	}));
	// Read resource-backed data only after its initial pending phase; keep controls mounted.
	const runsData = () => (runs.isPending ? undefined : runs.data);
	const current = createMemo(
		() =>
			runsData()?.find((run) => run.id === chosenRun()) ??
			runsData()?.find((run) => run.implementation === "typescript") ??
			runsData()?.[0],
	);
	const comparisonOptions = createMemo(() =>
		(runsData() ?? []).filter(
			(run) => run.id !== current()?.id && run.cohortId === current()?.cohortId,
		),
	);
	const comparison = createMemo(() =>
		comparisonOptions().find((run) => run.id === chosenComparison()),
	);
	const runId = () => current()?.id ?? "";
	createEffect(() => {
		const run = current();
		if (run) writePreference("run", run.id);
		writePreference("comparison", chosenComparison());
		writePreference("view", view());
	});

	const input = () => ({
		runId: runId(),
		comparisonRunId: comparison()?.id,
		query: appliedQuery(),
	});
	const groups = createInfiniteQuery(() => {
		const request = { ...input(), sort: sort(), limit: PAGE };
		return {
			queryKey: ["character-clustering", "groups-scroll", request],
			initialPageParam: 0,
			queryFn: ({ pageParam }) =>
				props.actions.listGroups({ ...request, offset: pageParam }),
			getNextPageParam: (
				last: ClusteringGroupsResponse,
				pages: ClusteringGroupsResponse[],
			) => {
				const count = pages.reduce((sum, page) => sum + page.groups.length, 0);
				return last.groups.length && count < last.total ? count : undefined;
			},
			staleTime: 30_000,
			enabled: Boolean(current()) && view() === "groups",
		};
	});
	const noise = createInfiniteQuery(() => {
		const request = {
			...input(),
			clusterId: -1,
			order: "name" as const,
			limit: IMAGES,
		};
		return {
			queryKey: ["character-clustering", "noise-scroll", request],
			initialPageParam: 0,
			queryFn: ({ pageParam }) =>
				props.actions.listMedia({ ...request, offset: pageParam }),
			getNextPageParam: (
				last: ClusteringMediaResponse,
				pages: ClusteringMediaResponse[],
			) => {
				const count = pages.reduce((sum, page) => sum + page.media.length, 0);
				return last.media.length && count < last.total ? count : undefined;
			},
			staleTime: 30_000,
			enabled: Boolean(current()) && view() === "noise",
		};
	});
	const detailInput = () => ({
		runId: runId(),
		comparisonRunId: comparison()?.id,
		clusterId: detailId() ?? -1,
		limit: IMAGES,
		query: "",
		order: detailOrder(),
	});
	const detail = createInfiniteQuery(() => {
		const request = detailInput();
		return {
			queryKey: ["character-clustering", "detail-scroll", request],
			initialPageParam: 0,
			queryFn: ({ pageParam }) =>
				props.actions.listMedia({ ...request, offset: pageParam }),
			getNextPageParam: (
				last: ClusteringMediaResponse,
				pages: ClusteringMediaResponse[],
			) => {
				const count = pages.reduce((sum, page) => sum + page.media.length, 0);
				return last.media.length && count < last.total ? count : undefined;
			},
			staleTime: 30_000,
			enabled: Boolean(current()) && detailId() !== null,
		};
	});
	const groupsData = () => (groups.isPending ? undefined : groups.data);
	const noiseData = () => (noise.isPending ? undefined : noise.data);
	const detailData = () => (detail.isPending ? undefined : detail.data);
	const groupItems = createMemo(
		() => groupsData()?.pages.flatMap((page) => page.groups) ?? [],
	);
	const noiseItems = createMemo(
		() => noiseData()?.pages.flatMap((page) => page.media) ?? [],
	);
	const detailItems = createMemo(
		() => detailData()?.pages.flatMap((page) => page.media) ?? [],
	);
	const reviewKey = () => JSON.stringify([input(), sort(), view()]);
	const loadGroups = () => {
		void groups.fetchNextPage({ cancelRefetch: false });
	};
	const loadNoise = () => {
		void noise.fetchNextPage({ cancelRefetch: false });
	};
	const loadDetail = () => {
		void detail.fetchNextPage({ cancelRefetch: false });
	};
	const reset = () => {
		setDetailId(null);
	};
	const follow = (cluster: number) => {
		const other = comparison();
		if (!other) return;
		batch(() => {
			const previous = runId();
			setChosenRun(other.id);
			setChosenComparison(previous);
			setDetailId(cluster < 0 ? null : cluster);
			setView(cluster < 0 ? "noise" : "groups");
			setQuery("");
			setAppliedQuery("");
		});
	};
	const refresh = () => {
		void runs.refetch();
		if (current()) {
			if (view() === "groups") void groups.refetch();
			else void noise.refetch();
			if (detailId() !== null) void detail.refetch();
		}
	};
	const visibleError = () =>
		view() === "groups"
			? groups.isError && !groupsData()
			: noise.isError && !noiseData();
	const fetching = () =>
		view() === "groups" ? groups.isFetching : noise.isFetching;
	const fetchingMore = () =>
		view() === "groups" ? groups.isFetchingNextPage : noise.isFetchingNextPage;
	const pending = () =>
		view() === "groups" ? groups.isPending : noise.isPending;
	const paused = () =>
		(view() === "groups" ? groups.fetchStatus : noise.fetchStatus) === "paused";
	const hasPage = () =>
		Boolean(view() === "groups" ? groupsData() : noiseData());
	const total = () =>
		view() === "groups"
			? (groupsData()?.pages[0]?.total ?? 0)
			: (noiseData()?.pages[0]?.total ?? 0);
	return (
		<div class="space-y-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="text-lg font-semibold">
						{t("jobTypes.character_clustering")}
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						{t(
							"characterClustering.compareMixedOrSplitGroupsWithUnclassifiedImages",
						)}
					</p>
				</div>
				<Button disabled={runs.isFetching} onClick={refresh} variant="outline">
					{t("characterClustering.reloadResults")}
				</Button>
			</div>
			<Show when={props.actions.startClustering}>
				{(start) => (
					<CharacterClusteringStart
						start={start()}
						openJobs={() => props.actions.openJobs?.()}
					/>
				)}
			</Show>
			<Show when={runs.isPending && runs.fetchStatus !== "paused"}>
				<p aria-live="polite" class="text-sm">
					{t("characterClustering.loadingAnalysisResults")}
				</p>
			</Show>
			<Show when={runs.fetchStatus === "paused" && !runsData()}>
				<OfflineState onRetry={refresh} />
			</Show>
			<Show when={runs.isError}>
				<ErrorState
					title={t("characterClustering.couldNotLoadAnalysisResults")}
					onRetry={() => void runs.refetch()}
				/>
			</Show>
			<Show when={runsData() && runsData()?.length === 0}>
				<EmptyState
					title={t("characterClustering.noSavedAnalysisResults")}
					description={t(
						"characterClustering.startClusteringThenReloadResultsAfterTheJobCompletes",
					)}
				/>
			</Show>
			<Show when={current()}>
				{(run) => (
					<>
						<div class="grid gap-3 md:grid-cols-2">
							<Select<ClusteringRunSummary>
								options={runsData() ?? []}
								value={run()}
								optionValue="id"
								optionTextValue={title}
								onChange={(value) => {
									if (value && value.id !== runId())
										batch(() => {
											setChosenRun(value.id);
											reset();
										});
								}}
								itemComponent={(item) => (
									<SelectItem item={item.item}>
										{title(item.item.rawValue)}
									</SelectItem>
								)}
							>
								<SelectLabel>
									{t("characterClustering.analysisResultToReview")}
								</SelectLabel>
								<SelectTrigger class="w-full min-w-0">
									<SelectValue<ClusteringRunSummary>>
										{(state) => (
											<span class="truncate">
												{state.selectedOption()
													? title(state.selectedOption())
													: ""}
											</span>
										)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
							<div class="flex min-w-0 items-end gap-2">
								<div class="min-w-0 flex-1">
									<Select<ClusteringRunSummary>
										options={comparisonOptions()}
										value={comparison() ?? null}
										optionValue="id"
										optionTextValue={title}
										placeholder={t("characterClustering.chooseComparison")}
										onChange={(value) => {
											if (value?.id !== chosenComparison())
												batch(() => {
													setChosenComparison(value?.id ?? "");
												});
										}}
										itemComponent={(item) => (
											<SelectItem item={item.item}>
												{title(item.item.rawValue)}
											</SelectItem>
										)}
									>
										<SelectLabel>
											{t(
												"characterClustering.compareDifferentSettingsOnTheSameImages",
											)}
										</SelectLabel>
										<SelectTrigger class="w-full min-w-0">
											<SelectValue<ClusteringRunSummary>>
												{(state) => (
													<span class="truncate">
														{state.selectedOption()
															? title(state.selectedOption())
															: ""}
													</span>
												)}
											</SelectValue>
										</SelectTrigger>
										<SelectContent />
									</Select>
								</div>
								<Show when={comparison()}>
									<Button
										aria-label={t("characterClustering.clearComparison")}
										onClick={() => setChosenComparison("")}
										variant="outline"
									>
										{t("actions.clear")}
									</Button>
								</Show>
							</div>
						</div>
						<dl class="grid grid-cols-2 gap-3 border-y py-3 md:grid-cols-4">
							<div>
								<dt class="text-xs text-muted-foreground">
									{t("characterClustering.targetImages")}
								</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{t("characterClustering.valueImages", {
										value0: String(run().points.toLocaleString()),
									})}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">
									{t("characterClustering.groups")}
								</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{t("characterClustering.valueGroups", {
										value0: String(run().clusters.toLocaleString()),
									})}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">
									{t("characterClustering.grouped")}
								</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{t("characterClustering.valueImages", {
										value0: String(run().clustered.toLocaleString()),
									})}
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">
									{t("characterClustering.noise")}
								</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{t("pixivScreen.imageCount", {
										count: run().noise.toLocaleString(),
									})}{" "}
									<span class="text-sm font-normal text-muted-foreground">
										(
										{((run().noise / Math.max(1, run().points)) * 100).toFixed(
											1,
										)}
										%)
									</span>
								</dd>
							</div>
						</dl>
						<p class="text-xs text-muted-foreground">
							{t(
								"characterClustering.valueValueExistingLabelsReflectTheTimeOfAnalysis",
								{
									value0: String(
										run().soloOnly
											? t(
													"characterClustering.onlyMediaTaggedSoloIsIncludedNotVerifiedBy",
												)
											: t(
													"characterClustering.theseResultsHaveNoPersonCountFilter",
												),
									),
								},
							)}
						</p>
						<div class="flex flex-wrap gap-2">
							<Button
								aria-pressed={view() === "groups"}
								onClick={() =>
									batch(() => {
										setView("groups");
										reset();
									})
								}
								variant={view() === "groups" ? "default" : "outline"}
							>
								{t("characterClustering.viewGroups")}
							</Button>
							<Button
								aria-pressed={view() === "noise"}
								onClick={() =>
									batch(() => {
										setView("noise");
										reset();
									})
								}
								variant={view() === "noise" ? "default" : "outline"}
							>
								{t("characterClustering.viewNoise")}
							</Button>
							<Button
								aria-pressed={large()}
								onClick={() => setLarge(!large())}
								variant="ghost"
							>
								{large()
									? t("characterClustering.smallerImages")
									: t("characterClustering.largerImages")}
							</Button>
						</div>
						<form
							class="flex flex-wrap items-end gap-2"
							onSubmit={(event) => {
								event.preventDefault();
								batch(() => {
									setAppliedQuery(query());
								});
							}}
						>
							<TextField
								class="min-w-0 flex-1"
								value={query()}
								onChange={setQuery}
							>
								<TextFieldLabel>
									{t("characterClustering.filterByExistingLabelOrFilename")}
								</TextFieldLabel>
								<TextFieldInput
									maxLength={200}
									placeholder={t("characterClustering.characterNameOrFilename")}
									type="search"
								/>
							</TextField>
							<Button type="submit">{t("characterClustering.filter")}</Button>
							<Show when={appliedQuery()}>
								<Button
									onClick={() =>
										batch(() => {
											setQuery("");
											setAppliedQuery("");
										})
									}
									variant="outline"
								>
									{t("actions.clear")}
								</Button>
							</Show>
						</form>
						<Show when={view() === "groups"}>
							<div class="flex flex-wrap gap-2">
								<For
									each={
										[
											{
												value: "size",
												label: t("characterClustering.mostImagesFirst"),
											},
											{
												value: "mixed",
												label: t("characterClustering.mixedLabelsFirst"),
											},
											{
												value: "weak",
												label: t(
													"characterClustering.lowestMembershipStrengthFirst",
												),
											},
										] as const
									}
								>
									{(option) => (
										<Button
											aria-pressed={sort() === option.value}
											class="text-xs"
											onClick={() =>
												batch(() => {
													setSort(option.value);
												})
											}
											variant={sort() === option.value ? "secondary" : "ghost"}
										>
											{option.label}
										</Button>
									)}
								</For>
							</div>
						</Show>
						<Show when={fetching() && !hasPage()}>
							<p aria-live="polite" class="text-sm text-muted-foreground">
								{t("characterClustering.loadingImages")}
							</p>
						</Show>
						<QueryStatus
							fetchState={
								paused()
									? "paused"
									: fetching() && hasPage() && !fetchingMore()
										? "background-fetching"
										: "idle"
							}
							hasData={hasPage()}
							hasError={
								view() === "groups"
									? groups.isError && !groups.isFetchNextPageError
									: noise.isError && !noise.isFetchNextPageError
							}
							hideWhenIdle
							offlineLabel={t(
								"characterClustering.offlineShowingPreviouslyLoadedImages",
							)}
							updatingLabel={t("characterClustering.updatingImages")}
						/>
						<Show when={paused() && !hasPage()}>
							<OfflineState onRetry={refresh} />
						</Show>
						<Show when={visibleError()}>
							<ErrorState
								title={t("characterClustering.couldNotLoadTheImageList")}
								description={t(
									"characterClustering.checkTheSavedAnalysisResultsAndRetry",
								)}
								onRetry={refresh}
							/>
						</Show>
						<Show when={!visibleError() && view() === "groups"}>
							<Show when={groups.isPending && !paused()}>
								<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
									<For each={Array.from({ length: 6 })}>
										{() => <Skeleton class="aspect-4/3 w-full" />}
									</For>
								</div>
							</Show>
							<p class="text-xs text-muted-foreground">
								{t(
									"characterClustering.strongMembersAreOnTopWeakerMembersBelowUp",
								)}
							</p>
							<ClusteringVirtualGrid
								items={groupItems()}
								itemKey={(group) => group.id}
								label={t("characterClustering.clusterList")}
								layout="groups"
								resetKey={reviewKey()}
								total={total()}
								canLoadMore={
									Boolean(groups.hasNextPage) &&
									!groups.isFetching &&
									!groups.isError &&
									groups.fetchStatus !== "paused"
								}
								onLoadMore={loadGroups}
							>
								{(group, index) => (
									<article class="relative grid min-w-0 gap-2 rounded-lg border p-3 transition-colors hover:border-primary/50 focus-within:border-primary/50">
										<Button
											aria-expanded={detailId() === group.id}
											aria-haspopup="dialog"
											aria-label={t(
												"characterClustering.reviewValueImagesInGroupValue",
												{
													value0: String(group.id),
													value1: String(group.size),
												},
											)}
											class="absolute inset-0 z-10 h-full w-full rounded-lg p-0 hover:bg-transparent"
											onClick={() =>
												batch(() => {
													setDetailId(group.id);
													setDetailOrder("weak");
												})
											}
											variant="ghost"
										>
											<span class="sr-only">
												{t(
													"characterClustering.viewAllValueImagesInGroupValue",
													{
														value0: String(group.id),
														value1: String(group.size),
													},
												)}
											</span>
										</Button>
										<div class="flex flex-wrap items-center justify-between gap-2">
											<h3 class="font-semibold">
												{t("characterClustering.groupValue", {
													value0: String(group.id),
												})}
											</h3>
											<span class="text-sm tabular-nums">
												{t("characterClustering.valueImages", {
													value0: String(group.size),
												})}
											</span>
										</div>
										<div class="grid w-full grid-cols-3 gap-1">
											<For each={group.previews}>
												{(image, imageIndex) => (
													<Thumbnail
														releaseUrl={props.actions.releaseThumbnailUrl}
														alt=""
														eager={index === 0 && imageIndex() === 0}
														src={props.actions.thumbnailUrl(
															image.mediaSourceId,
															image.id,
															image.modifiedAt,
														)}
													/>
												)}
											</For>
										</div>
										<div class="flex flex-wrap gap-1">
											<Show when={group.labelKinds > 1}>
												<Badge variant="outline">
													{t("characterClustering.valueExistingLabels", {
														value0: String(group.labelKinds),
													})}
												</Badge>
											</Show>
											<For each={group.characters}>
												{(character) => (
													<Button
														class="relative z-20 h-auto min-h-11 sm:min-h-8 max-w-full whitespace-normal px-1 text-xs"
														onClick={() =>
															batch(() => {
																setQuery(character.name);
																setAppliedQuery(character.name);
															})
														}
														variant="link"
													>
														{character.name} ({character.count})
													</Button>
												)}
											</For>
											<Show when={!group.characters.length}>
												<span class="text-xs text-muted-foreground">
													{t("characterClustering.noExistingLabels")}
												</span>
											</Show>
										</div>
										<p class="text-xs text-muted-foreground">
											{t(
												"characterClustering.membershipStrengthAverageValueMinimumValue",
												{
													value0: String(Math.round(group.meanStrength * 100)),
													value1: String(
														Math.round(group.minimumStrength * 100),
													),
												},
											)}
										</p>
										<Show when={group.comparison}>
											{(stats) => (
												<p class="text-xs text-muted-foreground">
													{t(
														"characterClustering.comparisonValueGroupsValueNoiseImagesValue",
														{
															value0: String(stats().clusters),
															value1: String(stats().noise),
															value2: String(
																stats().missing
																	? t(
																			"characterClustering.valueImagesExcluded",
																			{ value0: String(stats().missing) },
																		)
																	: "",
															),
														},
													)}
												</p>
											)}
										</Show>
									</article>
								)}
							</ClusteringVirtualGrid>
						</Show>
						<Show when={!visibleError() && view() === "noise"}>
							<ImageGrid
								actions={props.actions}
								comparing={Boolean(comparison())}
								large={large()}
								media={noiseItems()}
								label={t("characterClustering.noiseImages")}
								resetKey={reviewKey()}
								total={total()}
								canLoadMore={
									Boolean(noise.hasNextPage) &&
									!noise.isFetching &&
									!noise.isError &&
									noise.fetchStatus !== "paused"
								}
								onLoadMore={loadNoise}
								onFollow={follow}
							/>
						</Show>
						<Show
							when={
								!pending() && !fetching() && !visibleError() && total() === 0
							}
						>
							<EmptyState
								title={
									appliedQuery()
										? t("characterClustering.noImagesMatchTheseConditions")
										: view() === "noise"
											? t("characterClustering.thisAnalysisHasNoNoise")
											: t("characterClustering.thisAnalysisHasNoGroups")
								}
							/>
						</Show>
						<Show when={hasPage()}>
							<Continuation
								loaded={
									view() === "groups"
										? groupItems().length
										: noiseItems().length
								}
								total={total()}
								loading={
									view() === "groups"
										? groups.isFetchingNextPage
										: noise.isFetchingNextPage
								}
								hasMore={Boolean(
									view() === "groups" ? groups.hasNextPage : noise.hasNextPage,
								)}
								failed={
									view() === "groups"
										? groups.isFetchNextPageError
										: noise.isFetchNextPageError
								}
								paused={paused()}
								onLoad={view() === "groups" ? loadGroups : loadNoise}
							/>
						</Show>
					</>
				)}
			</Show>
			<Dialog
				open={detailId() !== null}
				onOpenChange={(open) => {
					if (!open) setDetailId(null);
				}}
			>
				<DialogContent
					class="max-w-7xl gap-3 p-3 sm:p-5"
					data-clustering-scroll
				>
					<DialogHeader class="static z-auto pr-8">
						<DialogTitle>
							{t("characterClustering.groupValueValueImages", {
								value0: String(detailId()),
								value1: String(detailData()?.pages[0]?.total ?? "…"),
							})}
						</DialogTitle>
						<DialogDescription>
							{t(
								"characterClustering.scrollThroughGroupMembersClickAThumbnailToOpen",
							)}
						</DialogDescription>
					</DialogHeader>
					<div class="flex flex-wrap gap-2">
						<Button
							aria-pressed={detailOrder() === "weak"}
							onClick={() =>
								batch(() => {
									setDetailOrder("weak");
								})
							}
							variant="outline"
						>
							{t("characterClustering.boundaryImagesFirst")}
						</Button>
						<Button
							aria-pressed={detailOrder() === "strong"}
							onClick={() =>
								batch(() => {
									setDetailOrder("strong");
								})
							}
							variant="outline"
						>
							{t("characterClustering.strongMembersFirst")}
						</Button>
						<Button
							aria-pressed={large()}
							onClick={() => setLarge(!large())}
							variant="ghost"
						>
							{large()
								? t("characterClustering.smallerImages")
								: t("characterClustering.largerImages")}
						</Button>
					</div>
					<Show when={detail.isFetching && !detail.isFetchingNextPage}>
						<p aria-live="polite" class="text-sm">
							{t("characterClustering.loadingGroupImages")}
						</p>
					</Show>
					<Show when={detail.fetchStatus === "paused"}>
						<OfflineState onRetry={() => void detail.refetch()} />
					</Show>
					<Show when={detail.isError && !detailData()}>
						<ErrorState
							title={t("characterClustering.couldNotLoadGroupImages")}
							onRetry={() => void detail.refetch()}
						/>
					</Show>
					<Show when={!detail.isError || detailData()}>
						<ImageGrid
							actions={props.actions}
							comparing={Boolean(comparison())}
							large={large()}
							media={detailItems()}
							label={t("characterClustering.groupImages")}
							resetKey={JSON.stringify(detailInput())}
							total={detailData()?.pages[0]?.total ?? 0}
							canLoadMore={
								Boolean(detail.hasNextPage) &&
								!detail.isFetching &&
								!detail.isError &&
								detail.fetchStatus !== "paused"
							}
							onLoadMore={loadDetail}
							onFollow={follow}
						/>
					</Show>
					<Show when={detailData()}>
						<Continuation
							loaded={detailItems().length}
							total={detailData()?.pages[0]?.total ?? 0}
							loading={detail.isFetchingNextPage}
							hasMore={Boolean(detail.hasNextPage)}
							failed={detail.isFetchNextPageError}
							paused={detail.fetchStatus === "paused"}
							onLoad={loadDetail}
						/>
					</Show>
				</DialogContent>
			</Dialog>
		</div>
	);
}
