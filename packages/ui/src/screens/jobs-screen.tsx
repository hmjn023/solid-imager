import { jobTypeLabel } from "../display-labels";
import { t } from "@solid-imager/i18n";
import { canRetryJob } from "@solid-imager/core/jobs";
import type { useJobInspection } from "../hooks/use-job-inspection";
import {
	isBatchParentJobType,
	type JobDto,
	type JobListResponse,
} from "@solid-imager/core/jobs";
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
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
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
import { ThumbnailImage } from "../thumbnail-image";
import {
	type BuildThumbnailUrlArgs,
	createHttpThumbnailSource,
	type ThumbnailRequestSize,
} from "../thumbnail-source";
import {
	CategoryLabel,
	ManagementHeader,
} from "../workspace/management-layout";
import {
	getRetryableJobIds,
	toggleAllJobSelection,
	toggleJobSelection,
} from "./jobs-selection";
import { formatDate } from "./manager/utils";

const JOB_FILTERS = [
	{
		description: t("jobsScreen.allJobs"),
		icon: Clock3,
		label: t("jobsScreen.all"),
		value: "all",
	},
	{
		description: t("jobsScreen.runningAndQueued"),
		icon: RefreshCw,
		label: t("jobsScreen.active"),
		value: "active",
	},
	{
		description: t("jobsScreen.jobsRequiringAttention"),
		icon: CircleAlert,
		label: t("status.failed"),
		value: "failed",
	},
	{
		description: t("jobsScreen.finishedJobs"),
		icon: CircleCheck,
		label: t("status.completed"),
		value: "completed",
	},
	{
		description: t("jobsScreen.cancelledJobs"),
		icon: Ban,
		label: t("status.cancelled"),
		value: "cancelled",
	},
] as const;

type JobFilter = (typeof JOB_FILTERS)[number]["value"];

export type JobsPagination = {
	canNext: boolean;
	canPrevious: boolean;
	current: number;
	onNext: () => void;
	onPrevious: () => void;
	total: number;
};

export type JobsScreenProps = {
	inspection?: ReturnType<typeof useJobInspection>;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	isRefreshing: Accessor<boolean>;
	jobs: Accessor<JobDto[]>;
	onRefresh: () => void | Promise<void>;
	onRetry: (jobId: string) => void | Promise<void>;
	onRetryMany: (jobIds: string[]) => void | Promise<void>;
	onCancel: (jobId: string) => void | Promise<void>;
	onDownload: (job: JobDto) => void | Promise<void>;
	page: Accessor<JobsPagination>;
	state: Accessor<QueryUiState<JobListResponse>>;
};

const JOB_BULK_ACTIONS = ["retry"] as const;
type JobBulkAction = (typeof JOB_BULK_ACTIONS)[number];

function jobBulkActionLabel(action: JobBulkAction): string {
	return action === "retry" ? t("jobsScreen.retryFailedJobs") : action;
}

function statusLabel(status: JobDto["status"]): string {
	return {
		cancelled: t("status.cancelled"),
		completed: t("status.completed"),
		failed: t("status.failed"),
		in_progress: t("status.inProgress"),
		pending: t("status.pending"),
	}[status];
}

function JobStatusBadge(props: { status: JobDto["status"] }) {
	return (
		<Badge
			classList={{
				"border-input": true,
				"bg-muted": props.status === "cancelled" || props.status === "failed",
				"text-muted-foreground": props.status === "cancelled",
				"text-destructive": props.status === "failed",
				"bg-accent": props.status === "completed",
				"text-primary": props.status === "completed",
				"bg-info": props.status === "in_progress",
				"text-info-foreground": props.status === "in_progress",
				"bg-warning": props.status === "pending",
				"text-warning-foreground": props.status === "pending",
			}}
			variant="outline"
		>
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
			fallback={<span class="text-muted-foreground">—</span>}
			when={props.progress}
		>
			{(progress) => (
				<div class="min-w-28 space-y-1">
					<div class="flex items-center justify-between gap-2 whitespace-nowrap text-xs tabular-nums">
						<span>{percent()}%</span>
						<span class="text-muted-foreground">
							{progress().processed.toLocaleString()}/
							{progress().total.toLocaleString()}
						</span>
					</div>
					<div
						aria-label={t("jobsScreen.valueComplete", {
							value0: String(percent()),
						})}
						aria-valuemax="100"
						aria-valuemin="0"
						aria-valuenow={percent()}
						class="h-1.5 overflow-hidden rounded-full bg-border"
						role="progressbar"
					>
						<div
							class="job-progress-fill h-full rounded-full bg-primary transition-width"
							style={{ "--job-progress-width": `${percent()}%` }}
						/>
					</div>
				</div>
			)}
		</Show>
	);
}

function JobThumbnail(props: {
	alt: string;
	buildUrl: (args: BuildThumbnailUrlArgs) => string;
	class: string;
	height: number;
	job: JobDto;
	requestedSize?: ThumbnailRequestSize;
	width: number;
}) {
	const source = createMemo(() => {
		const targetMediaId = props.job.targetMediaId;
		const mediaSourceId = props.job.mediaSourceId;
		const targetMediaModifiedAt = props.job.targetMediaModifiedAt;
		if (!targetMediaId || !mediaSourceId || !targetMediaModifiedAt) {
			return undefined;
		}

		return createHttpThumbnailSource({
			buildUrl: props.buildUrl,
			defaultSize: props.requestedSize ?? 256,
			mediaId: targetMediaId,
			mediaSourceId,
			modifiedAt: targetMediaModifiedAt,
		});
	});

	return (
		<Show
			fallback={
				<span aria-hidden="true" class="text-muted-foreground">
					—
				</span>
			}
			when={source()}
		>
			{(resolvedSource) => (
				<ThumbnailImage
					alt={props.alt}
					class={props.class}
					height={props.height}
					loading="lazy"
					source={resolvedSource()}
					width={props.width}
				/>
			)}
		</Show>
	);
}

function JobsTable(props: {
	jobs: JobDto[];
	onSelect: (job: JobDto) => void;
	onToggleSelect: (jobId: string) => void;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	selectedJobId: string | null;
	selectedJobIds: ReadonlySet<string>;
}) {
	return (
		<div class="overflow-hidden rounded-md border border-border bg-card">
			<div class="overflow-x-auto">
				{/* Live progress must not resize columns and rewrap neighboring rows. */}
				<table class="w-full min-w-table-wide table-fixed text-left text-sm">
					<caption class="sr-only">
						{t("jobsScreen.jobListValueJobs", {
							value0: String(props.jobs.length),
						})}
					</caption>
					<thead class="border-border border-b bg-muted text-xs uppercase tracking-wide">
						<tr>
							<th class="w-12 px-2 py-3 font-medium" scope="col">
								<span class="sr-only">{t("jobsScreen.select")}</span>
							</th>
							<th class="w-20 px-2 py-3 font-medium" scope="col">
								{t("jobsScreen.target")}
							</th>
							<th class="px-4 py-3 font-medium" scope="col">
								{t("jobsScreen.type")}
							</th>
							<th class="w-32 px-4 py-3 font-medium" scope="col">
								{t("jobsScreen.status")}
							</th>
							<th class="w-48 px-4 py-3 font-medium" scope="col">
								{t("jobsScreen.progress")}
							</th>
							<th class="w-48 px-4 py-3 font-medium" scope="col">
								{t("jobsScreen.updated")}
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						<For each={props.jobs}>
							{(job) => (
								<tr
									class={props.selectedJobId === job.id ? "bg-accent" : ""}
									data-selected={props.selectedJobId === job.id}
								>
									<td class="px-2 py-2">
										<Show
											fallback={
												<span
													aria-hidden="true"
													class="block text-center text-muted-foreground"
												>
													—
												</span>
											}
											when={job.status === "failed"}
										>
											<Checkbox
												aria-label={t("jobsScreen.selectValueJob", {
													value0: String(jobTypeLabel(job.type)),
												})}
												checked={props.selectedJobIds.has(job.id)}
												class="flex min-h-11 items-center justify-center sm:min-h-9"
												onChange={() => props.onToggleSelect(job.id)}
											>
												<CheckboxControl class="border-input bg-card data-[checked]:border-primary data-[checked]:bg-primary" />
												<CheckboxLabel class="sr-only">
													{t("jobsScreen.selectValueJob", {
														value0: String(jobTypeLabel(job.type)),
													})}
												</CheckboxLabel>
											</Checkbox>
										</Show>
									</td>
									<td class="px-2 py-2">
										<div class="flex size-12 items-center justify-center overflow-hidden rounded-sm text-xs">
											<JobThumbnail
												alt={t("jobsScreen.targetMediaForValueJob", {
													value0: String(jobTypeLabel(job.type)),
												})}
												buildUrl={props.buildThumbnailUrl}
												class="size-12 shrink-0 rounded-sm object-cover"
												height={48}
												job={job}
												width={48}
											/>
										</div>
									</td>
									<td class="px-2 py-2">
										<button
											aria-label={t("jobsScreen.valueJobValue", {
												value0: String(jobTypeLabel(job.type)),
												value1: String(job.id),
											})}
											aria-pressed={props.selectedJobId === job.id}
											class="w-full rounded px-2 py-2 text-left font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											onClick={() => props.onSelect(job)}
											type="button"
										>
											<div class="truncate" title={jobTypeLabel(job.type)}>
												{jobTypeLabel(job.type)}
											</div>
											<div class="mt-0.5 font-normal text-muted-foreground text-xs">
												{job.id.slice(0, 8)}
											</div>
										</button>
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										<JobStatusBadge status={job.status} />
									</td>
									<td class="px-4 py-3">
										<JobProgress progress={job.progress} />
									</td>
									<td class="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
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
		<div class="mb-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-wrap items-center gap-3">
				<Checkbox
					checked={props.allSelected}
					class="flex min-h-11 items-center gap-2 sm:min-h-9"
					indeterminate={props.hasSelection && !props.allSelected}
					onChange={props.onToggleAll}
				>
					<CheckboxControl class="border-input bg-card data-[checked]:border-primary data-[checked]:bg-primary" />
					<CheckboxLabel class="font-medium text-xs text-muted-foreground">
						{props.allSelected
							? t("jobsScreen.clearFailedSelection")
							: t("jobsScreen.selectAllFailedJobs")}
					</CheckboxLabel>
				</Checkbox>
				<span aria-live="polite" class="text-xs text-muted-foreground">
					{t("jobsScreen.valueOfValueValueFailedJobsSelected", {
						value0: String(props.selectedCount.toLocaleString()),
						value2: String(props.selectableCount.toLocaleString()),
					})}
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
					placeholder={t("jobsScreen.chooseAction")}
					value={props.action}
				>
					<SelectTrigger
						aria-label={t("jobsScreen.bulkJobAction")}
						class="w-full bg-card sm:min-h-9 sm:w-52"
						disabled={props.isApplying || !props.hasSelection}
					>
						<SelectValue<JobBulkAction>>
							{(state) => {
								const action = state.selectedOption();
								return action
									? jobBulkActionLabel(action)
									: t("jobsScreen.chooseAction");
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
					{props.isApplying ? t("status.retrying") : t("actions.apply")}
				</Button>
			</div>
		</div>
	);
}

function JobsInspector(props: {
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
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
		if (!job || !canRetryJob(job) || isRetrying()) return;
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
			aria-label={t("jobsScreen.jobDetails")}
			data-job-id={props.job?.id}
			class={
				props.class ??
				"hidden min-h-0 overflow-y-auto overscroll-contain border-border border-l bg-background p-5 scrollbar-stable xl:block"
			}
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs text-muted-foreground">
						{t("jobsScreen.inspector")}
					</p>
					<h2 class="mt-1 font-semibold text-base text-foreground">
						{t("jobsScreen.jobDetails")}
					</h2>
				</div>
				<Show when={props.job}>
					{(job) => <JobStatusBadge status={job().status} />}
				</Show>
			</div>

			<Show
				fallback={
					<p class="mt-3 text-sm leading-6 text-muted-foreground">
						{t("jobsScreen.selectAJobToSeeItsTargetAndStatus")}
					</p>
				}
				when={props.job}
			>
				{(job) => (
					<>
						<p class="mt-3 font-medium text-sm text-foreground">
							{jobTypeLabel(job().type)}
						</p>
						<Show
							fallback={
								<div
									aria-hidden="true"
									class="mt-4 flex h-24 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
								>
									—
								</div>
							}
							when={job().targetMediaId && job().mediaSourceId}
						>
							<div class="mt-4 overflow-hidden rounded-md border border-border bg-card">
								<JobThumbnail
									alt={t("jobsScreen.targetMediaForValueJob", {
										value0: String(jobTypeLabel(job().type)),
									})}
									buildUrl={props.buildThumbnailUrl}
									class="aspect-landscape w-full object-cover"
									height={192}
									job={job()}
									requestedSize={512}
									width={256}
								/>
								<p class="border-border border-t px-3 py-2 text-xs text-muted-foreground">
									{t("jobsScreen.targetMedia")}
								</p>
							</div>
						</Show>
						<dl class="mt-5 space-y-3 border-border border-y py-4 text-xs">
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.status")}</dt>
								<dd class="text-right text-muted-foreground">
									{statusLabel(job().status)}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("labels.source")}</dt>
								<dd class="max-w-40 truncate text-right text-muted-foreground">
									{job().mediaSourceId?.slice(0, 8) ?? "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.created")}</dt>
								<dd class="text-right text-muted-foreground">
									{formatDate(job().createdAt, { includeTime: true })}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.updated")}</dt>
								<dd class="text-right text-muted-foreground">
									{formatDate(job().updatedAt, { includeTime: true })}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">
									{t("jobsScreen.attempts")}
								</dt>
								<dd class="text-right text-muted-foreground">
									{job().attemptCount}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.started")}</dt>
								<dd class="text-right text-muted-foreground">
									{job().startedAt ? formatDate(job().startedAt) : "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">
									{t("jobsScreen.finished")}
								</dt>
								<dd class="text-right text-muted-foreground">
									{job().finishedAt ? formatDate(job().finishedAt) : "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.target")}</dt>
								<dd class="max-w-40 truncate text-right text-muted-foreground">
									{job().targetMediaId?.slice(0, 8) ?? "—"}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-muted-foreground">{t("jobsScreen.jobID")}</dt>
								<dd class="max-w-40 truncate text-right text-muted-foreground">
									{job().id}
								</dd>
							</div>
						</dl>

						<Show when={job().progress}>
							{(progress) => (
								<div class="mt-4">
									<p class="mb-2 text-xs text-muted-foreground">
										{t("jobsScreen.progress")}
									</p>
									<JobProgress progress={progress()} />
								</div>
							)}
						</Show>

						<Show when={job().error}>
							{(error) => (
								<div class="mt-4 rounded-md border border-input bg-muted p-3 text-destructive text-sm">
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
							<p class="mt-4 rounded-md border border-input bg-warning p-3 text-warning-foreground text-xs">
								{t("jobsScreen.cancellationRequestedAtValue", {
									value0: String(formatDate(job().cancelRequestedAt)),
								})}
							</p>
						</Show>

						<Show when={job().artifact}>
							{(artifact) => (
								<button
									aria-busy={isDownloading()}
									class="mt-4 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-primary hover:bg-muted"
									disabled={isDownloading()}
									onClick={() => void download()}
									type="button"
								>
									<Download aria-hidden="true" size={15} />
									<span class="min-w-0 truncate">
										{isDownloading()
											? t("jobsScreen.downloading")
											: t("jobsScreen.downloadValue", {
													value0: String(artifact().fileName),
												})}
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
									{isCancelling()
										? t("jobsScreen.cancelling")
										: t("jobsScreen.cancelJob")}
								</Button>
							</Show>
							<Show
								fallback={
									<p class="text-xs leading-5 text-muted-foreground">
										{t(
											"jobsScreen.retryIndividualFailedJobsHereForFailedBatchItems",
										)}
									</p>
								}
								when={canRetryJob(job())}
							>
								<Button
									aria-busy={isRetrying()}
									class="w-full"
									disabled={isRetrying()}
									onClick={() => void retry()}
									variant="outline"
								>
									<RotateCcw aria-hidden="true" size={15} />
									{isRetrying()
										? t("status.retrying")
										: t("jobsScreen.retryJob")}
								</Button>
							</Show>
						</div>
					</>
				)}
			</Show>
		</aside>
	);
}

export function JobsScreen(props: JobsScreenProps) {
	const [activeFilter, setActiveFilter] = createSignal<JobFilter>("all");
	const [localSelection, setLocalSelection] = createSignal<string | null>(null);
	const [selectedJobIds, setSelectedJobIds] = createSignal<Set<string>>(
		new Set(),
	);
	const [bulkAction, setBulkAction] = createSignal<JobBulkAction | null>(null);
	const [isApplyingBulkAction, setIsApplyingBulkAction] = createSignal(false);

	const selectedJob = createMemo(() =>
		props.inspection
			? props.inspection.job()
			: props.jobs().find((job) => job.id === localSelection()),
	);
	const selectJob = (job: JobDto) => {
		if (props.inspection) props.inspection.select(job.id);
		else setLocalSelection(job.id);
	};
	const selectedId = createMemo(() => selectedJob()?.id);
	let inlineInspector: HTMLDivElement | undefined;
	createEffect(() => {
		const id = selectedId();
		if (id)
			queueMicrotask(() => {
				if (id === selectedId() && inlineInspector?.getClientRects().length)
					inlineInspector.scrollIntoView({ block: "nearest" });
			});
	});
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
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<ManagementHeader
				actions={
					<div class="flex items-center gap-2">
						<Show when={props.state().data}>
							{(data) => (
								<span class="hidden text-xs text-muted-foreground sm:inline">
									{t("jobsScreen.valueJobs", {
										value0: String(data().total.toLocaleString()),
									})}
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
							{props.isRefreshing()
								? t("jobsScreen.refreshing")
								: t("actions.refresh")}
						</Button>
					</div>
				}
				description={t(
					"jobsScreen.reviewBackgroundJobProgressFailuresAndHistory",
				)}
				title={t("navigation.jobs")}
			/>

			<div class="grid min-h-0 flex-1 xl:grid-cols-detail-sidebar">
				<div class="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 scrollbar-stable">
					<Show when={props.inspection?.failed()}>
						<ErrorState
							title={t("jobsScreen.couldNotLoadTheSelectedJob")}
							description={t(
								"jobsScreen.reloadTheJobOrSelectAnotherOneFromThe",
							)}
							onRetry={() => props.inspection?.retry()}
						/>
					</Show>
					<Show when={selectedJob()}>
						{(job) => (
							<div
								ref={(element) => {
									inlineInspector = element;
								}}
								class="mb-4 xl:hidden"
							>
								<JobsInspector
									buildThumbnailUrl={props.buildThumbnailUrl}
									class="rounded-md border border-border bg-background p-4"
									job={job()}
									onCancel={props.onCancel}
									onDownload={props.onDownload}
									onRetry={props.onRetry}
								/>
							</div>
						)}
					</Show>
					<Tabs
						onChange={(value) => {
							setActiveFilter(value as JobFilter);
							clearBulkSelection();
						}}
						value={activeFilter()}
					>
						<div class="grid gap-6 lg:grid-cols-settings-sidebar xl:gap-8">
							<TabsList
								aria-label={t("jobsScreen.jobStatusFilter")}
								class="flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible"
							>
								<For each={JOB_FILTERS}>
									{(filter) => {
										const Icon = filter.icon;
										return (
											<TabsTrigger
												class="min-h-11 shrink-0 gap-2.5 rounded-md px-2.5 text-muted-foreground shadow-none data-[selected]:bg-accent data-[selected]:text-primary lg:min-h-10 lg:w-full lg:justify-start"
												type="button"
												value={filter.value}
											>
												<CategoryLabel
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
													<LoadingRegion label={t("jobsScreen.loadingJobs")}>
														<div class="h-64 rounded-md border border-border bg-card" />
													</LoadingRegion>
												</Match>
												<Match when={props.state().phase === "error"}>
													<ErrorState
														description={t(
															"jobsScreen.checkYourConnectionAndTryAgain",
														)}
														onRetry={refresh}
														title={t("jobsScreen.couldNotLoadJobs")}
													/>
												</Match>
												<Match when={props.state().phase === "offline"}>
													<OfflineState
														description={t(
															"jobsScreen.tryAgainWhenYourConnectionReturns",
														)}
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
																description={t(
																	"jobsScreen.newJobsAndTheirStatusWillAppearHere",
																)}
																title={t("jobsScreen.noJobsValue", {
																	value0: String(filter.label),
																})}
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
															buildThumbnailUrl={props.buildThumbnailUrl}
															jobs={filteredJobs()}
															onSelect={selectJob}
															onToggleSelect={toggleJob}
															selectedJobId={selectedId() ?? null}
															selectedJobIds={selectedJobIds()}
														/>
														<Show when={props.state().data?.total}>
															{(total) => (
																<p class="mt-3 text-xs text-muted-foreground">
																	{t(
																		"jobsScreen.showingValueValueOfValueValueJobs",
																		{
																			value1: String(
																				filteredJobs().length.toLocaleString(),
																			),
																			value3: String(total().toLocaleString()),
																		},
																	)}
																</p>
															)}
														</Show>
													</Show>
													<Show when={props.page().total > 1}>
														<nav
															aria-label={t("jobsScreen.jobPages")}
															class="mt-4 flex items-center justify-between gap-3"
														>
															<Button
																aria-label={t("jobsScreen.previousPage")}
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
																<span class="hidden sm:inline">
																	{t("actions.previous")}
																</span>
															</Button>
															<span
																aria-live="polite"
																class="text-sm text-muted-foreground"
															>
																{t("jobsScreen.pageValueOfValueValue", {
																	value0: String(props.page().current),
																	value2: String(props.page().total),
																})}
															</span>
															<Button
																aria-label={t("jobsScreen.nextPage")}
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
																<span class="hidden sm:inline">
																	{t("actions.next")}
																</span>
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
					buildThumbnailUrl={props.buildThumbnailUrl}
					job={selectedJob()}
					onCancel={props.onCancel}
					onDownload={props.onDownload}
					onRetry={props.onRetry}
				/>
			</div>
		</section>
	);
}
