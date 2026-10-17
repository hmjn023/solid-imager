import type {
	ProcessingListRequest,
	ProcessingListResponse,
	ProcessingRetryRequest,
	SafeMediaProcessing,
	SafeProcessingStep,
	ProcessingFailureCode,
	MediaTaskKind,
} from "@solid-imager/core/domain/processing/schemas";
import type { SourceEvent } from "@solid-imager/core/domain/sources/events";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import {
	createComputed,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
	Switch,
	Match,
} from "solid-js";
import { createStore, reconcile } from "solid-js/store";
import { isServer } from "solid-js/web";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import { Badge } from "../badge";
import { Button } from "../button";
import { TextField, TextFieldInput, TextFieldLabel } from "../text-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../table";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { LoadingRegion } from "../skeleton";
import { subscribeToEventStream } from "../event-stream";
import { toQueryUiState } from "../query-state";
import { toast } from "../toast";
import { createDebouncedSignal } from "../utils/debounce";
import { formatDate } from "./manager/utils";

export type ProcessingApi = {
	list(input: ProcessingListRequest): Promise<ProcessingListResponse>;
	get(input: { mediaId: string }): Promise<SafeMediaProcessing>;
	retry(input: ProcessingRetryRequest): Promise<SafeMediaProcessing>;
	openEvents(signal: AbortSignal): Promise<AsyncIterable<SourceEvent>>;
};
export const processingQueryKeys = { all: () => ["media-processing"] as const };
const PAGE_SIZE = 25;
const KINDS: MediaTaskKind[] = ["metadata", "thumbnail", "tagging", "ccip"];
export const processingKindLabels: Record<MediaTaskKind, string> = {
	metadata: "Metadata",
	thumbnail: "Thumbnails",
	tagging: "AI tagging",
	ccip: "Full-image CCIP",
};
const failureMessages: Record<ProcessingFailureCode, string> = {
	file_missing: "元ファイルが見つかりません。保存先を確認してください。",
	file_access_denied:
		"元ファイルへのアクセスが拒否されました。アクセス権を確認してください。",
	service_unavailable:
		"処理サービスへの接続に失敗しました。接続状態を確認してください。",
	input_changed: "処理中に入力が更新されました。現在の入力で再試行できます。",
	lease_expired: "実行が中断され、処理の有効期限が切れました。",
	retry_limit:
		"自動再試行の上限に達しました。原因を確認して再試行してください。",
	processing_failed: "処理に失敗しました。詳細はサーバーログで確認できます。",
};
export function processingStatusLabel(step: SafeProcessingStep) {
	if (
		!step.isCurrent &&
		step.status !== "not_requested" &&
		step.status !== "skipped"
	)
		return "Outdated";
	return {
		not_requested: "Not requested",
		skipped: "Skipped",
		pending: "Pending",
		in_progress: "In progress",
		completed: "Completed",
		failed: "Failed",
	}[step.status];
}
function ProcessingBadge(props: { step: SafeProcessingStep }) {
	return (
		<Badge
			variant="outline"
			classList={{
				"text-destructive": props.step.status === "failed",
				"bg-accent text-primary":
					props.step.status === "completed" && props.step.isCurrent,
				"bg-warning text-warning-foreground":
					props.step.status === "pending" || !props.step.isCurrent,
				"bg-info text-info-foreground":
					props.step.status === "in_progress" && props.step.isCurrent,
			}}
		>
			{processingStatusLabel(props.step)}
		</Badge>
	);
}

function ProcessingDetails(props: {
	media: SafeMediaProcessing;
	busy: string | null;
	onRetry: (
		media: SafeMediaProcessing,
		step: SafeProcessingStep,
	) => Promise<void>;
}) {
	return (
		<section aria-label="Media processing details" class="space-y-4">
			<div>
				<h2 class="break-words text-base font-semibold">
					{props.media.fileName}
				</h2>
				<p class="mt-1 text-xs text-muted-foreground">
					{props.media.sourceName}
				</p>
			</div>
			<For each={props.media.steps}>
				{(step) => (
					<section
						aria-label={processingKindLabels[step.kind]}
						class="space-y-2 border-t border-border pt-4"
					>
						<div class="flex flex-wrap items-center justify-between gap-2">
							<h3 class="text-sm font-medium">
								{processingKindLabels[step.kind]}
							</h3>
							<ProcessingBadge step={step} />
						</div>
						<dl class="space-y-1 text-xs text-muted-foreground">
							<div class="flex justify-between gap-2">
								<dt>Attempts</dt>
								<dd>
									{step.attemptCount}
									{step.maxAttempts ? ` / ${step.maxAttempts}` : ""}
								</dd>
							</div>
							<div class="flex justify-between gap-2">
								<dt>Updated</dt>
								<dd>
									{step.updatedAt
										? formatDate(step.updatedAt, { includeTime: true })
										: "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-2">
								<dt>Next run</dt>
								<dd>
									{step.availableAt
										? formatDate(step.availableAt, { includeTime: true })
										: "—"}
								</dd>
							</div>
						</dl>
						<Show when={step.failureCode}>
							{(code) => (
								<p class="text-xs leading-5 text-destructive">
									{failureMessages[code()]}
								</p>
							)}
						</Show>
						<Show
							when={
								!step.isCurrent &&
								step.status !== "not_requested" &&
								step.status !== "skipped"
							}
						>
							<p class="text-xs leading-5 text-muted-foreground">
								入力または設定が更新されています。以前の要求の状態を表示しています。
							</p>
						</Show>
						<Show when={step.status === "not_requested"}>
							<p class="text-xs leading-5 text-muted-foreground">
								この工程の処理要求はまだ保存されていません。
							</p>
						</Show>
						<Show when={step.canRetry}>
							<Button
								aria-label={`Retry ${processingKindLabels[step.kind]}`}
								aria-busy={props.busy === `${props.media.mediaId}:${step.kind}`}
								disabled={props.busy !== null}
								size="sm"
								variant="outline"
								onClick={() => void props.onRetry(props.media, step)}
							>
								<RotateCcw aria-hidden="true" size={14} />
								Retry this step
							</Button>
						</Show>
					</section>
				)}
			</For>
		</section>
	);
}

export function MediaProcessingPanel(props: { api: ProcessingApi }) {
	const client = useQueryClient();
	const [search, setSearch] = createSignal("");
	const [debouncedSearch, setDebouncedSearch] = createDebouncedSignal("", 250);
	const [status, setStatus] = createSignal<ProcessingListRequest["status"]>();
	const [page, setPage] = createSignal(0);
	const [selected, setSelected] = createSignal<string | null>(null);
	const [busy, setBusy] = createSignal<string | null>(null);
	const input = createMemo((): ProcessingListRequest => ({
		query: debouncedSearch(),
		status: status(),
		offset: page() * PAGE_SIZE,
		limit: PAGE_SIZE,
	}));
	const list = createQuery(() => ({
		queryKey: [...processingQueryKeys.all(), "list", input()],
		queryFn: () => props.api.list(input()),
		staleTime: 5_000,
		// SSE is a hint. Recheck active requests if an event was missed.
		refetchInterval: (query) =>
			query.state.data?.items.some((media) =>
				media.steps.some(
					(step) =>
						step.isCurrent &&
						(step.status === "pending" || step.status === "in_progress"),
				),
			)
				? 15_000
				: false,
	}));
	const detail = createQuery(() => ({
		queryKey: [...processingQueryKeys.all(), "detail", selected()],
		queryFn: () => {
			const mediaId = selected();
			if (!mediaId) throw new Error("No media selected");
			return props.api.get({ mediaId });
		},
		enabled: selected() !== null,
	}));
	const [selectedData, setSelectedData] = createStore<{
		media?: SafeMediaProcessing;
	}>({});
	createComputed(() => {
		if (detail.data?.mediaId === selected())
			setSelectedData("media", reconcile(detail.data, { key: "mediaId" }));
		else setSelectedData("media", undefined);
	});
	const [rows, setRows] = createStore<{ items: SafeMediaProcessing[] }>({
		items: [],
	});
	createComputed(() => {
		if (list.data)
			setRows("items", reconcile(list.data.items, { key: "mediaId" }));
	});
	createEffect(() => {
		debouncedSearch();
		status();
		setPage(0);
	});
	const refresh = () =>
		client.invalidateQueries(
			{ queryKey: processingQueryKeys.all() },
			{ cancelRefetch: false },
		);
	createEffect(() => {
		if (isServer) return;
		let dirty = false;
		let running = false;
		let disposed = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		// Coalesce bursts while retaining one trailing fetch for changes during an in-flight request.
		const scheduleRefresh = () => {
			dirty = true;
			if (running || timer || disposed) return;
			timer = setTimeout(async () => {
				timer = undefined;
				dirty = false;
				running = true;
				try {
					await refresh();
				} catch {
					/* Query error state retains the visible content. */
				} finally {
					running = false;
					if (dirty && !disposed) scheduleRefresh();
				}
			}, 150);
		};
		const stop = subscribeToEventStream(
			(signal) => props.api.openEvents(signal),
			(event) => {
				switch (event.event) {
					case "media-deleted":
						if (event.data.mediaId === selected()) setSelected(null);
						scheduleRefresh();
						break;
					case "media-processing-changed":
					case "media-added":
					case "media-changed":
					case "media-copied":
					case "media-moved":
					case "thumbnail-generated":
						scheduleRefresh();
						break;
					case "all-jobs-completed":
					case "watcher-error":
					case "source-sync-status":
					case "download-error":
						break;
					default: {
						const never: never = event;
						throw new Error(
							`Unhandled processing notification: ${String(never)}`,
						);
					}
				}
			},
			undefined,
			scheduleRefresh,
		);
		onCleanup(() => {
			disposed = true;
			if (timer) clearTimeout(timer);
			stop();
		});
	});
	const retry = async (
		media: SafeMediaProcessing,
		step: SafeProcessingStep,
	) => {
		if (!step.canRetry || !step.requestId || busy()) return;
		setBusy(`${media.mediaId}:${step.kind}`);
		try {
			const updated = await props.api.retry({
				mediaId: media.mediaId,
				kind: step.kind,
				requestId: step.requestId,
			});
			client.setQueryData(
				[...processingQueryKeys.all(), "detail", media.mediaId],
				updated,
			);
			await refresh();
			toast.success(`${processingKindLabels[step.kind]} queued for retry`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to retry processing",
			);
			await refresh();
		} finally {
			setBusy(null);
		}
	};
	const ui = () =>
		toQueryUiState(list, { isEmpty: (data) => data.items.length === 0 });
	const filters = [
		"all",
		"pending",
		"in_progress",
		"failed",
		"completed",
	] as const;
	return (
		<div class="grid min-h-0 flex-1 xl:grid-cols-detail-sidebar">
			<div class="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 scrollbar-stable">
				<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
					<TextField
						class="min-w-0 flex-1"
						value={search()}
						onChange={(value) => {
							setSearch(value);
							setDebouncedSearch(value);
						}}
					>
						<TextFieldLabel>Search media processing</TextFieldLabel>
						<TextFieldInput placeholder="Search by filename" />
					</TextField>
					<Select<(typeof filters)[number]>
						options={[...filters]}
						value={status() ?? "all"}
						onChange={(value) =>
							setStatus(value === "all" || !value ? undefined : value)
						}
						itemComponent={(item) => (
							<SelectItem item={item.item}>
								{item.item.rawValue.replaceAll("_", " ")}
							</SelectItem>
						)}
					>
						<SelectTrigger
							aria-label="Processing request status"
							class="w-full sm:w-44"
						>
							<SelectValue<(typeof filters)[number]>>
								{(state) =>
									state.selectedOption()?.replaceAll("_", " ") ?? "all"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<Button
						variant="outline"
						size="sm"
						aria-busy={list.isFetching}
						onClick={() => void refresh()}
					>
						<RefreshCw size={14} aria-hidden="true" />
						Refresh processing
					</Button>
				</div>
				<p class="mb-3 text-xs leading-5 text-muted-foreground">
					メディアごとの現在の要求を表示します。絞り込みは保存された要求状態に対して適用されます。
				</p>
				<Show when={list.data && list.error}>
					<div class="mb-3">
						<ErrorState
							title="状態の更新に失敗しました"
							description="表示中の状態を保持しています。接続を確認して再試行してください。"
							onRetry={refresh}
						/>
					</div>
				</Show>
				<Switch>
					<Match when={ui().phase === "pending"}>
						<LoadingRegion label="処理状態を読み込んでいます..." />
					</Match>
					<Match when={ui().phase === "error"}>
						<ErrorState
							title="処理状態を取得できませんでした"
							onRetry={refresh}
						/>
					</Match>
					<Match when={ui().phase === "offline"}>
						<OfflineState onRetry={refresh} />
					</Match>
					<Match when={ui().phase === "empty"}>
						<EmptyState
							title="対象のメディアはありません"
							description="検索または要求状態の条件を変更してください。"
						/>
					</Match>
					<Match when={ui().phase === "data"}>
						<div class="rounded-md border border-border bg-card">
							<Table class="min-w-table-wide">
								<TableCaption class="sr-only">
									Media processing states
								</TableCaption>
								<TableHeader>
									<TableRow>
										<TableHead scope="col">Media</TableHead>
										<For each={KINDS}>
											{(kind) => (
												<TableHead scope="col">
													{processingKindLabels[kind]}
												</TableHead>
											)}
										</For>
									</TableRow>
								</TableHeader>
								<TableBody>
									<For each={rows.items}>
										{(media) => (
											<TableRow
												data-state={
													selected() === media.mediaId ? "selected" : undefined
												}
											>
												<TableCell>
													<Button
														variant="ghost"
														class="h-auto w-full justify-start text-left"
														aria-label={`Processing details for ${media.fileName}`}
														aria-pressed={selected() === media.mediaId}
														onClick={() => setSelected(media.mediaId)}
													>
														<span class="min-w-0">
															<span class="block truncate font-medium">
																{media.fileName}
															</span>
															<span class="block text-xs text-muted-foreground">
																{media.sourceName}
															</span>
														</span>
													</Button>
												</TableCell>
												<For each={media.steps}>
													{(step) => (
														<TableCell>
															<ProcessingBadge step={step} />
														</TableCell>
													)}
												</For>
											</TableRow>
										)}
									</For>
								</TableBody>
							</Table>
						</div>
					</Match>
				</Switch>
				<div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
					<span aria-live="polite">
						{list.data?.total ?? 0} media · Page {page() + 1}
					</span>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							aria-label="Previous processing page"
							disabled={page() === 0}
							onClick={() => setPage((current) => Math.max(0, current - 1))}
						>
							<ChevronLeft size={14} />
						</Button>
						<Button
							variant="outline"
							size="sm"
							aria-label="Next processing page"
							disabled={(page() + 1) * PAGE_SIZE >= (list.data?.total ?? 0)}
							onClick={() => setPage((current) => current + 1)}
						>
							<ChevronRight size={14} />
						</Button>
					</div>
				</div>
				<Show when={selected()}>
					<div class="mt-6 border-t border-border pt-5 xl:hidden">
						<Show when={selectedData.media}>
							{(media) => (
								<ProcessingDetails
									media={media()}
									busy={busy()}
									onRetry={retry}
								/>
							)}
						</Show>
						<Show when={detail.error}>
							<ErrorState
								title="詳細を取得できませんでした"
								onRetry={async () => {
									await detail.refetch();
								}}
							/>
						</Show>
					</div>
				</Show>
			</div>
			<aside
				aria-label="Processing inspector"
				class="hidden min-h-0 overflow-y-auto border-l border-border p-5 xl:block scrollbar-stable"
			>
				<Show
					when={selectedData.media}
					fallback={
						<p class="text-sm text-muted-foreground">
							メディアを選択すると4工程の状態と個別再試行を表示します。
						</p>
					}
				>
					{(media) => (
						<ProcessingDetails media={media()} busy={busy()} onRetry={retry} />
					)}
				</Show>
				<Show when={detail.error}>
					<ErrorState
						title="詳細を取得できませんでした"
						onRetry={async () => {
							await detail.refetch();
						}}
					/>
				</Show>
			</aside>
		</div>
	);
}
