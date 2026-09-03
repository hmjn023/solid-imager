import {
	isBatchParentJobType,
	type JobDto,
	type JobListResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import Ban from "lucide-solid/icons/ban";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import Clock3 from "lucide-solid/icons/clock-3";
import Download from "lucide-solid/icons/download";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import type { Accessor } from "solid-js";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { Badge } from "../badge";
import { Button } from "../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../checkbox";
import type { QueryUiState } from "../query-state";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import { LoadingRegion } from "../skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import {
	V2_CATEGORY_TABS_CLASS,
	V2CategoryLabel,
	V2ManagementHeader,
} from "../v2/management-layout";
import {
	getRetryableJobIds,
	toggleAllJobSelection,
	toggleJobSelection,
} from "./v2-jobs-selection";
import { formatDate } from "./v2-manager/utils";

const JOB_FILTERS = [
	{ description: "すべての処理", icon: Clock3, label: "All", value: "all" },
	{
		description: "実行中と待機中",
		icon: RefreshCw,
		label: "Active",
		value: "active",
	},
	{
		description: "確認が必要な処理",
		icon: CircleAlert,
		label: "Failed",
		value: "failed",
	},
	{
		description: "完了した処理",
		icon: CircleCheck,
		label: "Completed",
		value: "completed",
	},
	{
		description: "キャンセルされた処理",
		icon: Ban,
		label: "Cancelled",
		value: "cancelled",
	},
] as const;

type JobFilter = (typeof JOB_FILTERS)[number]["value"];

export type V2JobsPagination = {
	canNext: boolean;
	canPrevious: boolean;
	current: number;
	onNext: () => void;
	onPrevious: () => void;
	total: number;
};

export type V2JobsScreenProps = {
	isRefreshing: Accessor<boolean>;
	jobs: Accessor<JobDto[]>;
	onRefresh: () => void | Promise<void>;
	onRetry: (jobId: string) => void | Promise<void>;
	onRetryMany: (jobIds: string[]) => void | Promise<void>;
	onCancel: (jobId: string) => void | Promise<void>;
	onDownload: (job: JobDto) => void | Promise<void>;
	page: Accessor<V2JobsPagination>;
	state: Accessor<QueryUiState<JobListResponse>>;
};

const JOB_BULK_ACTIONS = ["retry"] as const;
type JobBulkAction = (typeof JOB_BULK_ACTIONS)[number];

function jobBulkActionLabel(action: JobBulkAction): string {
	return action === "retry" ? "Retry failed jobs" : action;
}

function jobTypeLabel(type: string): string {
	return type
		.replaceAll("_", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(status: JobDto["status"]): string {
	return {
		cancelled: "Cancelled",
		completed: "Completed",
		failed: "Failed",
		in_progress: "In progress",
		pending: "Pending",
	}[status];
}

function statusClass(status: JobDto["status"]): string {
	return {
		cancelled:
			"border-[var(--v2-border-strong)] bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]",
		completed:
			"border-[var(--v2-border-strong)] bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]",
		failed:
			"border-[var(--v2-border-strong)] bg-[var(--v2-surface-muted)] text-[var(--v2-destructive)]",
		in_progress:
			"border-[var(--v2-border-strong)] bg-[var(--v2-info-surface)] text-[var(--v2-info)]",
		pending:
			"border-[var(--v2-border-strong)] bg-[var(--v2-warning-surface)] text-[var(--v2-warning)]",
	}[status];
}

function JobStatusBadge(props: { status: JobDto["status"] }) {
	return (
		<Badge class={statusClass(props.status)} variant="outline">
			{statusLabel(props.status)}
		</Badge>
	);
}

function JobProgress(props: { progress: JobDto["progress"] }) {
	const percent = () => {
		if (!props.progress || props.progress.total === 0) return 0;
		return Math.min(
			100,
			Math.round((props.progress.processed / props.progress.total) * 100),
		);
	};

	return (
		<Show
			fallback={<span class="text-[var(--v2-text-muted)]">—</span>}
			when={props.progress}
		>
			{(progress) => (
				<div class="min-w-28 space-y-1">
					<div class="flex items-center justify-between gap-2 text-xs">
						<span>{percent()}%</span>
						<span class="text-[var(--v2-text-muted)]">
							{progress().processed.toLocaleString()}/
							{progress().total.toLocaleString()}
						</span>
					</div>
					<div
						aria-label={`${percent()}% complete`}
						aria-valuemax="100"
						aria-valuemin="0"
						aria-valuenow={percent()}
						class="h-1.5 overflow-hidden rounded-full bg-[var(--v2-border)]"
						role="progressbar"
					>
						<div
							class="h-full rounded-full bg-[var(--v2-primary)] transition-[width]"
							style={{ width: `${percent()}%` }}
						/>
					</div>
				</div>
			)}
		</Show>
	);
}

function JobsTable(props: {
	jobs: JobDto[];
	onSelect: (job: JobDto) => void;
	onToggleSelect: (jobId: string) => void;
	selectedJobId: string | null;
	selectedJobIds: ReadonlySet<string>;
}) {
	return (
		<div class="overflow-hidden rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)]">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[50rem] text-left text-sm">
					<caption class="sr-only">
						ジョブの一覧。{props.jobs.length}件。
					</caption>
					<thead class="border-[var(--v2-border)] border-b bg-[var(--v2-surface-muted)] text-xs uppercase tracking-wide">
						<tr>
							<th class="w-12 px-2 py-3 font-medium" scope="col">
								<span class="sr-only">Select</span>
							</th>
							<th class="px-4 py-3 font-medium" scope="col">
								Type
							</th>
							<th class="px-4 py-3 font-medium" scope="col">
								Status
							</th>
							<th class="px-4 py-3 font-medium" scope="col">
								Progress
							</th>
							<th class="px-4 py-3 font-medium" scope="col">
								Updated
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--v2-border)]">
						<For each={props.jobs}>
							{(job) => (
								<tr
									class={
										props.selectedJobId === job.id
											? "bg-[var(--v2-primary-soft)]"
											: ""
									}
									data-selected={props.selectedJobId === job.id}
								>
									<td class="px-2 py-2">
										<Show
											fallback={
												<span
													aria-hidden="true"
													class="block text-center text-[var(--v2-text-muted)]"
												>
													—
												</span>
											}
											when={job.status === "failed"}
										>
											<Checkbox
												checked={props.selectedJobIds.has(job.id)}
												class="flex min-h-11 items-center justify-center sm:min-h-9"
												onChange={() => props.onToggleSelect(job.id)}
											>
												<CheckboxControl class="border-[var(--v2-border-strong)] bg-[var(--v2-surface)] data-[checked]:border-[var(--v2-primary)] data-[checked]:bg-[var(--v2-primary)]" />
												<CheckboxLabel class="sr-only">
													Select {jobTypeLabel(job.type)} job
												</CheckboxLabel>
											</Checkbox>
										</Show>
									</td>
									<td class="px-2 py-2">
										<button
											aria-pressed={props.selectedJobId === job.id}
											class="w-full rounded px-2 py-2 text-left font-medium text-[var(--v2-text)] hover:bg-[var(--v2-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-primary)]"
											onClick={() => props.onSelect(job)}
											type="button"
										>
											<div>{jobTypeLabel(job.type)}</div>
											<div class="mt-0.5 font-normal text-[var(--v2-text-muted)] text-xs">
												{job.id.slice(0, 8)}
											</div>
										</button>
									</td>
									<td class="px-4 py-3">
										<JobStatusBadge status={job.status} />
									</td>
									<td class="px-4 py-3">
										<JobProgress progress={job.progress} />
									</td>
									<td class="px-4 py-3 whitespace-nowrap text-[var(--v2-text-secondary)]">
										{formatDate(job.updatedAt, { includeTime: true })}
									</td>
								</tr>
							)}
						</For>
					</tbody>
				</table>
			</div>
		</div>
	);
}

function JobsBulkActions(props: {
	action: JobBulkAction | null;
	allSelected: boolean;
	hasSelection: boolean;
	isApplying: boolean;
	onActionChange: (action: JobBulkAction | null) => void;
	onApply: () => void | Promise<void>;
	onToggleAll: () => void;
	selectableCount: number;
	selectedCount: number;
}) {
	return (
		<div class="mb-3 flex flex-col gap-3 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-wrap items-center gap-3">
				<Checkbox
					checked={props.allSelected}
					class="flex min-h-11 items-center gap-2 sm:min-h-9"
					indeterminate={props.hasSelection && !props.allSelected}
					onChange={props.onToggleAll}
				>
					<CheckboxControl class="border-[var(--v2-border-strong)] bg-[var(--v2-surface)] data-[checked]:border-[var(--v2-primary)] data-[checked]:bg-[var(--v2-primary)]" />
					<CheckboxLabel class="font-medium text-xs text-[var(--v2-text-secondary)]">
						{props.allSelected
							? "Clear failed selection"
							: "Select all failed jobs"}
					</CheckboxLabel>
				</Checkbox>
				<span aria-live="polite" class="text-xs text-[var(--v2-text-muted)]">
					{props.selectedCount.toLocaleString()} of{" "}
					{props.selectableCount.toLocaleString()} failed jobs selected
				</span>
			</div>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Select<JobBulkAction>
					itemComponent={(selectProps) => (
						<SelectItem item={selectProps.item}>
							{jobBulkActionLabel(selectProps.item.rawValue)}
						</SelectItem>
					)}
					onChange={props.onActionChange}
					options={[...JOB_BULK_ACTIONS]}
					placeholder="Choose action"
					value={props.action}
				>
					<SelectTrigger
						aria-label="Bulk job action"
						class="w-full bg-[var(--v2-surface)] sm:min-h-9 sm:w-52"
						disabled={props.isApplying || !props.hasSelection}
					>
						<SelectValue<JobBulkAction>>
							{(state) => {
								const action = state.selectedOption();
								return action ? jobBulkActionLabel(action) : "Choose action";
							}}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<Button
					aria-busy={props.isApplying}
					class="min-h-11 sm:min-h-9"
					disabled={
						props.isApplying || !props.hasSelection || props.action === null
					}
					onClick={() => void props.onApply()}
					size="sm"
				>
					<RotateCcw aria-hidden="true" size={14} />
					{props.isApplying ? "Retrying..." : "Apply"}
				</Button>
			</div>
		</div>
	);
}

function JobsInspector(props: {
	class?: string;
	job: JobDto | undefined;
	onCancel: (jobId: string) => void | Promise<void>;
	onDownload: (job: JobDto) => void | Promise<void>;
	onRetry: (jobId: string) => void | Promise<void>;
}) {
	const [isRetrying, setIsRetrying] = createSignal(false);
	const [isCancelling, setIsCancelling] = createSignal(false);
	const [isDownloading, setIsDownloading] = createSignal(false);

	const retry = async () => {
		const job = props.job;
		if (job?.status !== "failed" || isRetrying()) return;
		setIsRetrying(true);
		try {
			await props.onRetry(job.id);
		} catch {
			// The route reports mutation failures; keep the selected job visible.
		} finally {
			setIsRetrying(false);
		}
	};
	const download = async () => {
		const job = props.job;
		if (!job?.artifact || isDownloading()) return;
		setIsDownloading(true);
		try {
			await props.onDownload(job);
		} catch {
			// The route reports download failures; keep the selected job visible.
		} finally {
			setIsDownloading(false);
		}
	};
	const cancel = async () => {
		const job = props.job;
		if (
			!job ||
			(job.status !== "pending" && job.status !== "in_progress") ||
			isBatchParentJobType(job.type) ||
			isCancelling()
		)
			return;
		setIsCancelling(true);
		try {
			await props.onCancel(job.id);
		} catch {
			// The route reports mutation failures; keep the selected job visible.
		} finally {
			setIsCancelling(false);
		}
	};

	return (
		<aside
			aria-label="Job details"
			class={
				props.class ??
				"hidden min-h-0 overflow-y-auto overscroll-contain border-[var(--v2-border)] border-l bg-[var(--v2-surface-subtle)] p-5 [scrollbar-gutter:stable] xl:block"
			}
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs text-[var(--v2-text-muted)]">Inspector</p>
					<h2 class="mt-1 font-semibold text-base text-[var(--v2-text)]">
						Job details
					</h2>
				</div>
				<Show when={props.job}>
					{(job) => <JobStatusBadge status={job().status} />}
				</Show>
			</div>

			<Show
				fallback={
					<p class="mt-3 text-sm leading-6 text-[var(--v2-text-secondary)]">
						一覧からジョブを選択すると、対象と実行状態を表示します。
					</p>
				}
				when={props.job}
			>
				{(job) => (
					<>
						<p class="mt-3 font-medium text-sm text-[var(--v2-text)]">
							{jobTypeLabel(job().type)}
						</p>
						<dl class="mt-5 space-y-3 border-[var(--v2-border)] border-y py-4 text-xs">
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Status</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{statusLabel(job().status)}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Source</dt>
								<dd class="max-w-40 truncate text-right text-[var(--v2-text-secondary)]">
									{job().mediaSourceId?.slice(0, 8) ?? "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Created</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{formatDate(job().createdAt, { includeTime: true })}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Updated</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{formatDate(job().updatedAt, { includeTime: true })}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Attempts</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{job().attemptCount}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Started</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{job().startedAt ? formatDate(job().startedAt) : "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Finished</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{job().finishedAt ? formatDate(job().finishedAt) : "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Target</dt>
								<dd class="max-w-40 truncate text-right text-[var(--v2-text-secondary)]">
									{job().targetMediaId?.slice(0, 8) ?? "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Job ID</dt>
								<dd class="max-w-40 truncate text-right text-[var(--v2-text-secondary)]">
									{job().id}
								</dd>
							</div>
						</dl>

						<Show when={job().progress}>
							{(progress) => (
								<div class="mt-4">
									<p class="mb-2 text-xs text-[var(--v2-text-muted)]">
										Progress
									</p>
									<JobProgress progress={progress()} />
								</div>
							)}
						</Show>

						<Show when={job().error}>
							{(error) => (
								<div class="mt-4 rounded-md border border-[var(--v2-border-strong)] bg-[var(--v2-surface-muted)] p-3 text-[var(--v2-destructive)] text-sm">
									<div class="flex items-start gap-2">
										<CircleAlert
											aria-hidden="true"
											class="mt-0.5 shrink-0"
											size={16}
										/>
										<p class="break-words">{error()}</p>
									</div>
								</div>
							)}
						</Show>

						<Show when={job().cancelRequestedAt}>
							<p class="mt-4 rounded-md border border-[var(--v2-border-strong)] bg-[var(--v2-warning-surface)] p-3 text-[var(--v2-warning)] text-xs">
								Cancellation requested at {formatDate(job().cancelRequestedAt)}.
							</p>
						</Show>

						<Show when={job().artifact}>
							{(artifact) => (
								<button
									aria-busy={isDownloading()}
									class="mt-4 flex w-full items-center gap-2 rounded-md border border-[var(--v2-border)] px-3 py-2 text-left text-sm text-[var(--v2-primary)] hover:bg-[var(--v2-surface-muted)]"
									disabled={isDownloading()}
									onClick={() => void download()}
									type="button"
								>
									<Download aria-hidden="true" size={15} />
									<span class="min-w-0 truncate">
										{isDownloading()
											? "Downloading..."
											: `Download ${artifact().fileName}`}
									</span>
								</button>
							)}
						</Show>

						<div class="mt-5 space-y-2">
							<Show
								fallback={null}
								when={
									(job().status === "pending" ||
										job().status === "in_progress") &&
									!isBatchParentJobType(job().type)
								}
							>
								<Button
									aria-busy={isCancelling()}
									class="w-full"
									disabled={isCancelling()}
									onClick={() => void cancel()}
									variant="outline"
								>
									<Ban aria-hidden="true" size={15} />
									{isCancelling() ? "Cancelling..." : "Cancel job"}
								</Button>
							</Show>
							<Show
								fallback={
									<p class="text-xs leading-5 text-[var(--v2-text-muted)]">
										再実行できるのは失敗したジョブのみです。
									</p>
								}
								when={job().status === "failed"}
							>
								<Button
									aria-busy={isRetrying()}
									class="w-full"
									disabled={isRetrying()}
									onClick={() => void retry()}
									variant="outline"
								>
									<RotateCcw aria-hidden="true" size={15} />
									{isRetrying() ? "Retrying..." : "Retry job"}
								</Button>
							</Show>
						</div>
					</>
				)}
			</Show>
		</aside>
	);
}

export function V2JobsScreen(props: V2JobsScreenProps) {
	const [activeFilter, setActiveFilter] = createSignal<JobFilter>("all");
	const [selectedJobId, setSelectedJobId] = createSignal<string | null>(null);
	const [selectedJobIds, setSelectedJobIds] = createSignal<Set<string>>(
		new Set(),
	);
	const [bulkAction, setBulkAction] = createSignal<JobBulkAction | null>(null);
	const [isApplyingBulkAction, setIsApplyingBulkAction] = createSignal(false);

	const selectedJob = createMemo(() =>
		props.jobs().find((job) => job.id === selectedJobId()),
	);
	const filteredJobs = createMemo(() => {
		const jobs = props.jobs();
		switch (activeFilter()) {
			case "active":
				return jobs.filter(
					(job) => job.status === "pending" || job.status === "in_progress",
				);
			case "completed":
				return jobs.filter((job) => job.status === "completed");
			case "failed":
				return jobs.filter((job) => job.status === "failed");
			case "cancelled":
				return jobs.filter((job) => job.status === "cancelled");
			default:
				return jobs;
		}
	});
	const retryableJobIds = createMemo(() => getRetryableJobIds(filteredJobs()));
	const selectedRetryableJobIds = createMemo(() =>
		retryableJobIds().filter((jobId) => selectedJobIds().has(jobId)),
	);
	const clearBulkSelection = () => {
		setSelectedJobIds(new Set<string>());
		setBulkAction(null);
	};
	const toggleJob = (jobId: string) => {
		setSelectedJobIds((current) => toggleJobSelection(current, jobId));
	};
	const toggleAllJobs = () => {
		setSelectedJobIds((current) =>
			toggleAllJobSelection(current, retryableJobIds()),
		);
	};
	const applyBulkAction = async () => {
		const action = bulkAction();
		const jobIds = selectedRetryableJobIds();
		if (action !== "retry" || jobIds.length === 0 || isApplyingBulkAction()) {
			return;
		}
		setIsApplyingBulkAction(true);
		try {
			await props.onRetryMany(jobIds);
			clearBulkSelection();
		} catch {
			// The route reports mutation failures; keep any remaining selection visible.
		} finally {
			setIsApplyingBulkAction(false);
		}
	};
	const refresh = async () => {
		await props.onRefresh();
	};

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2ManagementHeader
				actions={
					<div class="flex items-center gap-2">
						<Show when={props.state().data}>
							{(data) => (
								<span class="hidden text-xs text-[var(--v2-text-muted)] sm:inline">
									{data().total.toLocaleString()} jobs
								</span>
							)}
						</Show>
						<Button
							aria-busy={props.isRefreshing()}
							disabled={props.isRefreshing()}
							onClick={() => void refresh()}
							size="sm"
							variant="outline"
						>
							<RefreshCw aria-hidden="true" size={14} />
							{props.isRefreshing() ? "Refreshing..." : "Refresh"}
						</Button>
					</div>
				}
				description="バックグラウンド処理の進捗、失敗、履歴を確認します。"
				title="Jobs"
			/>

			<div class="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div class="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 [scrollbar-gutter:stable]">
					<Tabs
						onChange={(value) => {
							setActiveFilter(value as JobFilter);
							clearBulkSelection();
						}}
						value={activeFilter()}
					>
						<div class="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:gap-8">
							<TabsList
								aria-label="Job status filter"
								class="flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible"
							>
								<For each={JOB_FILTERS}>
									{(filter) => {
										const Icon = filter.icon;
										return (
											<TabsTrigger
												class={V2_CATEGORY_TABS_CLASS}
												type="button"
												value={filter.value}
											>
												<V2CategoryLabel
													description={filter.description}
													icon={<Icon aria-hidden="true" size={16} />}
													label={filter.label}
												/>
											</TabsTrigger>
										);
									}}
								</For>
							</TabsList>
							<div class="min-w-0">
								<For each={JOB_FILTERS}>
									{(filter) => (
										<TabsContent class="mt-0" value={filter.value}>
											<Switch>
												<Match when={props.state().phase === "pending"}>
													<LoadingRegion label="ジョブ一覧を読み込んでいます...">
														<div class="h-64 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)]" />
													</LoadingRegion>
												</Match>
												<Match when={props.state().phase === "error"}>
													<ErrorState
														description="接続を確認して、もう一度お試しください。"
														onRetry={refresh}
														title="ジョブ一覧を取得できませんでした"
													/>
												</Match>
												<Match when={props.state().phase === "offline"}>
													<OfflineState
														description="接続が戻ったら再試行してください。"
														onRetry={refresh}
													/>
												</Match>
												<Match
													when={
														props.state().phase === "data" ||
														props.state().phase === "empty"
													}
												>
													<Show
														fallback={
															<EmptyState
																description="ジョブが作成されると、ここに実行状態が表示されます。"
																title={`${filter.label} jobsはありません`}
															/>
														}
														when={filteredJobs().length > 0}
													>
														<Show when={retryableJobIds().length > 0}>
															<JobsBulkActions
																action={bulkAction()}
																allSelected={
																	selectedRetryableJobIds().length ===
																	retryableJobIds().length
																}
																hasSelection={
																	selectedRetryableJobIds().length > 0
																}
																isApplying={isApplyingBulkAction()}
																onActionChange={setBulkAction}
																onApply={applyBulkAction}
																onToggleAll={toggleAllJobs}
																selectableCount={retryableJobIds().length}
																selectedCount={selectedRetryableJobIds().length}
															/>
														</Show>
														<JobsTable
															jobs={filteredJobs()}
															onSelect={(job) => setSelectedJobId(job.id)}
															onToggleSelect={toggleJob}
															selectedJobId={selectedJobId()}
															selectedJobIds={selectedJobIds()}
														/>
														<Show when={props.state().data?.total}>
															{(total) => (
																<p class="mt-3 text-xs text-[var(--v2-text-muted)]">
																	Showing{" "}
																	{filteredJobs().length.toLocaleString()} of{" "}
																	{total().toLocaleString()} jobs
																</p>
															)}
														</Show>
														<Show when={selectedJob()}>
															{(job) => (
																<JobsInspector
																	class="mt-4 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface-subtle)] p-4 xl:hidden"
																	job={job()}
																	onCancel={props.onCancel}
																	onDownload={props.onDownload}
																	onRetry={props.onRetry}
																/>
															)}
														</Show>
													</Show>
													<Show when={props.page().total > 1}>
														<nav
															aria-label="Job pages"
															class="mt-4 flex items-center justify-between gap-3"
														>
															<Button
																aria-label="Previous page"
																disabled={
																	!props.page().canPrevious ||
																	props.isRefreshing()
																}
																onClick={() => {
																	if (props.page().canPrevious) {
																		clearBulkSelection();
																		props.page().onPrevious();
																	}
																}}
																size="sm"
																variant="outline"
															>
																<ChevronLeft aria-hidden="true" size={14} />
																<span class="hidden sm:inline">Previous</span>
															</Button>
															<span
																aria-live="polite"
																class="text-sm text-[var(--v2-text-muted)]"
															>
																Page {props.page().current} of{" "}
																{props.page().total}
															</span>
															<Button
																aria-label="Next page"
																disabled={
																	!props.page().canNext || props.isRefreshing()
																}
																onClick={() => {
																	if (props.page().canNext) {
																		clearBulkSelection();
																		props.page().onNext();
																	}
																}}
																size="sm"
																variant="outline"
															>
																<span class="hidden sm:inline">Next</span>
																<ChevronRight aria-hidden="true" size={14} />
															</Button>
														</nav>
													</Show>
												</Match>
											</Switch>
										</TabsContent>
									)}
								</For>
							</div>
						</div>
					</Tabs>
				</div>

				<JobsInspector
					job={selectedJob()}
					onCancel={props.onCancel}
					onDownload={props.onDownload}
					onRetry={props.onRetry}
				/>
			</div>
		</section>
	);
}
