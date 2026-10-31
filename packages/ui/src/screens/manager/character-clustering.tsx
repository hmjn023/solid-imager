import type {
	ClusteringGroupsRequest,
	ClusteringGroupsResponse,
	ClusteringMediaRequest,
	ClusteringMediaResponse,
	ClusteringReviewMedia,
	ClusteringRunSummary,
} from "@solid-imager/core/domain/characters/schemas";
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

export type CharacterClusteringReviewActions = {
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
	return `${run.name.split("/").at(-1)} · 最小${p.minClusterSize}枚 / 密度${p.minSamples} / 近傍${p.neighbors} / ${p.selectionMethod}`;
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
				fallback="画像を取得できません"
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
				読み込み済み {props.loaded.toLocaleString()} /{" "}
				{props.total.toLocaleString()}件
			</p>
			<Show when={props.failed}>
				<ErrorState title="続きを取得できませんでした" onRetry={props.onLoad} />
			</Show>
			<Show when={props.hasMore && !props.failed}>
				<Button
					disabled={props.loading || props.paused}
					onClick={props.onLoad}
					variant="outline"
				>
					{props.loading ? "続きを読み込んでいます…" : "続きを読み込む"}
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
						aria-label={`${media.fileName}を開く`}
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
							"既存ラベルなし"}
					</p>
					<Show when={media.clusterId >= 0}>
						<p class="text-xs text-muted-foreground">
							所属強度 {Math.round(media.membershipStrength * 100)}%
						</p>
					</Show>
					<Show when={props.comparing}>
						<Show
							when={media.comparisonClusterId !== null}
							fallback={
								<span class="text-xs text-muted-foreground">
									比較先では対象外
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
								比較先:{" "}
								{media.comparisonClusterId === -1
									? "ノイズ"
									: `グループ #${media.comparisonClusterId}`}
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
					<h2 class="text-lg font-semibold">キャラクタークラスタリング</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						グループの混入・分断と、分類されなかった画像を見比べます。
					</p>
				</div>
				<Button disabled={runs.isFetching} onClick={refresh} variant="outline">
					結果を再読み込み
				</Button>
			</div>
			<Show when={runs.isPending && runs.fetchStatus !== "paused"}>
				<p aria-live="polite" class="text-sm">
					解析結果を読み込んでいます…
				</p>
			</Show>
			<Show when={runs.fetchStatus === "paused" && !runsData()}>
				<OfflineState onRetry={refresh} />
			</Show>
			<Show when={runs.isError}>
				<ErrorState
					title="解析結果を取得できませんでした"
					onRetry={() => void runs.refetch()}
				/>
			</Show>
			<Show when={runsData() && runsData()?.length === 0}>
				<EmptyState
					title="保存済みの解析結果がありません"
					description="解析結果と、その解析で使った画像一覧をサーバーへ配置すると確認できます。"
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
								<SelectLabel>確認する解析結果</SelectLabel>
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
										placeholder="比較先を選ぶ"
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
										<SelectLabel>同じ画像の別設定と比較</SelectLabel>
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
										aria-label="比較を解除"
										onClick={() => setChosenComparison("")}
										variant="outline"
									>
										解除
									</Button>
								</Show>
							</div>
						</div>
						<dl class="grid grid-cols-2 gap-3 border-y py-3 md:grid-cols-4">
							<div>
								<dt class="text-xs text-muted-foreground">対象画像</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{run().points.toLocaleString()}枚
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">グループ</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{run().clusters.toLocaleString()}群
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">グループ内</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{run().clustered.toLocaleString()}枚
								</dd>
							</div>
							<div>
								<dt class="text-xs text-muted-foreground">ノイズ</dt>
								<dd class="text-lg font-semibold tabular-nums">
									{run().noise.toLocaleString()}枚{" "}
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
							{run().soloOnly
								? "soloタグ付きが対象（人物検知による確認は行っていません）。"
								: "人数による絞り込みのない解析結果です。"}{" "}
							既存ラベルは解析時点の情報です。所属強度は識別の正解率ではありません。
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
								グループを見る
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
								ノイズを見る
							</Button>
							<Button
								aria-pressed={large()}
								onClick={() => setLarge(!large())}
								variant="ghost"
							>
								{large() ? "画像を小さく" : "画像を大きく"}
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
									既存ラベル・ファイル名で絞り込む
								</TextFieldLabel>
								<TextFieldInput
									maxLength={200}
									placeholder="キャラクター名やファイル名"
									type="search"
								/>
							</TextField>
							<Button type="submit">絞り込む</Button>
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
									クリア
								</Button>
							</Show>
						</form>
						<Show when={view() === "groups"}>
							<div class="flex flex-wrap gap-2">
								<For
									each={
										[
											{ value: "size", label: "枚数が多い順" },
											{ value: "mixed", label: "ラベル混在を優先" },
											{ value: "weak", label: "所属強度が低い順" },
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
								画像一覧を読み込んでいます…
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
							offlineLabel="オフラインのため取得済みの画像を表示しています。"
							updatingLabel="画像一覧を更新しています…"
						/>
						<Show when={paused() && !hasPage()}>
							<OfflineState onRetry={refresh} />
						</Show>
						<Show when={visibleError()}>
							<ErrorState
								title="画像一覧を取得できませんでした"
								description="保存済みの解析結果を確認して再試行してください。"
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
								上段は所属が強い画像、下段は弱い画像です（最大各3枚）。
							</p>
							<ClusteringVirtualGrid
								items={groupItems()}
								itemKey={(group) => group.id}
								label="クラスタ一覧"
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
											aria-label={`グループ #${group.id} の${group.size}枚を確認`}
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
												グループ #{group.id} の全{group.size}枚を見る
											</span>
										</Button>
										<div class="flex flex-wrap items-center justify-between gap-2">
											<h3 class="font-semibold">グループ #{group.id}</h3>
											<span class="text-sm tabular-nums">{group.size}枚</span>
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
													既存ラベル{group.labelKinds}種
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
													既存ラベルなし
												</span>
											</Show>
										</div>
										<p class="text-xs text-muted-foreground">
											所属強度 平均{Math.round(group.meanStrength * 100)}% /
											最低{Math.round(group.minimumStrength * 100)}%
										</p>
										<Show when={group.comparison}>
											{(stats) => (
												<p class="text-xs text-muted-foreground">
													比較先では {stats().clusters}グループ / ノイズ
													{stats().noise}枚
													{stats().missing
														? ` / 対象外${stats().missing}枚`
														: ""}
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
								label="ノイズ画像"
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
										? "条件に一致する画像がありません"
										: view() === "noise"
											? "この解析結果にノイズはありません"
											: "この解析結果にグループはありません"
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
							グループ #{detailId()} · {detailData()?.pages[0]?.total ?? "…"}枚
						</DialogTitle>
						<DialogDescription>
							所属画像をスクロールして確認できます。サムネイルをクリックすると画像の詳細ページへ移動します。
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
							境界の画像から
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
							強い画像から
						</Button>
						<Button
							aria-pressed={large()}
							onClick={() => setLarge(!large())}
							variant="ghost"
						>
							{large() ? "画像を小さく" : "画像を大きく"}
						</Button>
					</div>
					<Show when={detail.isFetching && !detail.isFetchingNextPage}>
						<p aria-live="polite" class="text-sm">
							グループの画像を読み込んでいます…
						</p>
					</Show>
					<Show when={detail.fetchStatus === "paused"}>
						<OfflineState onRetry={() => void detail.refetch()} />
					</Show>
					<Show when={detail.isError && !detailData()}>
						<ErrorState
							title="グループの画像を取得できませんでした"
							onRetry={() => void detail.refetch()}
						/>
					</Show>
					<Show when={!detail.isError || detailData()}>
						<ImageGrid
							actions={props.actions}
							comparing={Boolean(comparison())}
							large={large()}
							media={detailItems()}
							label="グループ画像"
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
