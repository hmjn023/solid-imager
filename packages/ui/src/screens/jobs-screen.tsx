import ArrowLeft from "lucide-solid/icons/arrow-left";
import ChevronDown from "lucide-solid/icons/chevron-down";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../collapsible";
import { createStore, reconcile, unwrap } from "solid-js/store";
import { observePageBoundary } from "../hooks/observe-page-boundary";
import { Input } from "../input";
import { Label } from "../label";
import { jobsQueryKeys } from "../query-options/jobs-query";
import { createQuery } from "@tanstack/solid-query";
import type { BatchTargets } from "@solid-imager/core/jobs";
import { PaginationControls } from "../pagination-controls";
import { jobTypeLabel } from "../display-labels";
import { t } from "@solid-imager/i18n";
import {
	canCancelJobType,
	canRetryJob,
	hasBatchTargetHistory,
} from "@solid-imager/core/jobs";
import type { useJobInspection } from "../hooks/use-job-inspection";
import {
	isBatchParentJobType,
	type JobDto,
	type JobListRequest,
	type JobListResponse,
} from "@solid-imager/core/jobs";
import Ban from "lucide-solid/icons/ban";
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
	createUniqueId,
	For,
	Match,
	Show,
	Switch,
} from "solid-js";
import { Alert, AlertDescription } from "../alert";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { Badge } from "../badge";
import { Button } from "../button";
import { Callout, CalloutContent } from "../callout";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../checkbox";
import { Progress } from "../progress";
import type { QueryUiState } from "../query-state";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../select";
import { LoadingRegion } from "../skeleton";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../table";
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
	ManagementScreen,
	ManagementScrollArea,
	MANAGEMENT_CONTENT_PADDING,
	MANAGEMENT_CATEGORY_GRID,
	MANAGEMENT_CATEGORY_LIST,
} from "../workspace/management-layout";
import {
	getRetryableJobIds,
	toggleAllJobSelection,
	toggleJobSelection,
} from "./jobs-selection";
import { formatDate } from "./manager/utils";

const JOB_FILTERS = [
	{
		get description() {
			return t("jobsScreen.allJobs");
		},
		icon: Clock3,
		get label() {
			return t("jobsScreen.all");
		},
		value: "all",
	},
	{
		get description() {
			return t("jobsScreen.runningAndQueued");
		},
		icon: RefreshCw,
		get label() {
			return t("jobsScreen.active");
		},
		value: "active",
	},
	{
		get description() {
			return t("jobsScreen.jobsRequiringAttention");
		},
		icon: CircleAlert,
		get label() {
			return t("status.failed");
		},
		value: "failed",
	},
	{
		get description() {
			return t("jobsScreen.finishedJobs");
		},
		icon: CircleCheck,
		get label() {
			return t("status.completed");
		},
		value: "completed",
	},
	{
		get description() {
			return t("jobsScreen.cancelledJobs");
		},
		icon: Ban,
		get label() {
			return t("status.cancelled");
		},
		value: "cancelled",
	},
] as const;

type LoadTargets = (
	id: string,
	offset: number,
	limit: number,
	signal: AbortSignal,
) => Promise<BatchTargets>;

export type JobsScreenProps = {
	loadTargets?: LoadTargets;
	onUploadTarget?: (
		sourceId: string,
		reservationId: string,
		filename: string,
		file: File,
	) => Promise<unknown>;
	inspection?: ReturnType<typeof useJobInspection>;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	isRefreshing: Accessor<boolean>;
	jobs: Accessor<JobDto[]>;
	onRefresh: () => void | Promise<void>;
	onRetry: (
		jobId: string,
		replacementUploadId?: string,
	) => void | Promise<void>;
	onRetryMany: (jobIds: string[]) => void | Promise<void>;
	onCancel: (jobId: string) => void | Promise<void>;
	onDownload: (job: JobDto) => void | Promise<void>;
	status: Accessor<JobListRequest["status"]>;
	onStatusChange: (status: JobListRequest["status"]) => void;
	type: Accessor<string | undefined>;
	onTypeChange: (type: string | undefined) => void;
	jobTypes: Accessor<QueryUiState<string[]>>;
	onRetryTypes: () => void;
	hasMore: Accessor<boolean>;
	isLoadingMore: Accessor<boolean>;
	loadMoreError: Accessor<boolean>;
	onLoadMore: () => void;
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

function JobProgress(props: { progress: JobDto["progress"]; label?: string }) {
	const finished = () =>
		props.progress
			? props.progress.processed +
				props.progress.failed +
				(props.progress.cancelled ?? 0)
			: 0;
	const percent = () => {
		const progress = props.progress;
		if (!progress || progress.total === 0) return 0;
		const work = progress.importWork;
		if (!work)
			return Math.min(100, Math.round((finished() / progress.total) * 100));
		// Each target also contributes once all of its work has settled. This
		// leaves room for stages that have not been scheduled yet.
		return Math.min(
			99,
			((finished() + work.settled) / (progress.total + work.total)) * 100,
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
						<span>{Math.round(percent())}%</span>
						<span class="text-muted-foreground">
							{finished().toLocaleString()}/{progress().total.toLocaleString()}
						</span>
					</div>
					<Progress
						aria-label={
							props.label ??
							t("jobsScreen.valueComplete", {
								value0: String(Math.round(percent())),
							})
						}
						class="h-1.5 bg-border [&>div]:bg-border [&>div>div]:rounded-full"
						maxValue={100}
						minValue={0}
						value={percent()}
					/>
				</div>
			)}
		</Show>
	);
}

function ImportStageProgress(props: {
	stages: NonNullable<BatchTargets["stages"]>;
	active: boolean;
}) {
	const heading = createUniqueId();
	return (
		<section
			aria-labelledby={heading}
			class="mb-5 rounded-md border border-border bg-card p-3"
		>
			<h3 id={heading} class="font-semibold text-sm">
				{t("jobsScreen.stageProgress")}
			</h3>
			<Show when={props.active}>
				<p class="mt-1 text-xs text-muted-foreground">
					{t("jobsScreen.stageProgressScope")}
				</p>
			</Show>
			<ul class="mt-3 grid gap-x-5 gap-y-4 @lg:grid-cols-2">
				<For each={props.stages}>
					{(stage) => (
						<li class="min-w-0 space-y-1">
							<p class="font-medium text-sm">{jobTypeLabel(stage.type)}</p>
							<JobProgress progress={stage} label={jobTypeLabel(stage.type)} />
							<p class="text-xs text-muted-foreground tabular-nums">
								{t("jobsScreen.stageProgressCounts", {
									completed: stage.processed.toLocaleString(),
									running: stage.running.toLocaleString(),
									pending: stage.pending.toLocaleString(),
									failed: stage.failed.toLocaleString(),
								})}
							</p>
							<Show when={stage.cancelled > 0}>
								<p class="text-xs text-muted-foreground tabular-nums">
									{t("jobsScreen.cancelledCount", {
										count: stage.cancelled.toLocaleString(),
									})}
								</p>
							</Show>
						</li>
					)}
				</For>
			</ul>
		</section>
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
	compact: boolean;
	jobs: JobDto[];
	onSelect: (job: JobDto) => void;
	onToggleSelect: (jobId: string) => void;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	selectedJobId: string | null;
	selectedJobIds: ReadonlySet<string>;
}) {
	// Own the row objects so reconciliation never mutates query-cache data.
	const copyJobs = () => structuredClone(unwrap(props.jobs));
	const [rows, setRows] = createStore<{ jobs: JobDto[] }>({ jobs: copyJobs() });
	createEffect(() => setRows("jobs", reconcile(copyJobs(), { key: "id" })));
	return (
		<div class="overflow-hidden rounded-md border border-border bg-card">
			{/* Live progress must not resize columns and rewrap neighboring rows. */}
			<Table
				class={
					props.compact
						? "table-fixed text-left [&_th:first-child]:hidden [&_td:first-child]:hidden [&_th:nth-child(2)]:hidden [&_td:nth-child(2)]:hidden [&_th:nth-child(5)]:hidden [&_td:nth-child(5)]:hidden [&_th:nth-child(6)]:hidden [&_td:nth-child(6)]:hidden"
						: "min-w-table-wide table-fixed text-left"
				}
			>
				<TableCaption class="sr-only">
					{t("jobsScreen.jobListValueJobs", {
						value0: String(props.jobs.length),
					})}
				</TableCaption>
				<TableHeader class="border-border border-b bg-muted text-xs uppercase tracking-wide">
					<TableRow class="hover:bg-transparent">
						<TableHead class="h-auto w-12 px-2 py-3" scope="col">
							<span class="sr-only">{t("jobsScreen.select")}</span>
						</TableHead>
						<TableHead class="h-auto w-20 px-2 py-3" scope="col">
							{t("jobsScreen.target")}
						</TableHead>
						<TableHead class="h-auto px-4 py-3" scope="col">
							{t("jobsScreen.type")}
						</TableHead>
						<TableHead class="h-auto w-32 px-4 py-3" scope="col">
							{t("jobsScreen.status")}
						</TableHead>
						<TableHead class="h-auto w-48 px-4 py-3" scope="col">
							{t("jobsScreen.progress")}
						</TableHead>
						<TableHead class="h-auto w-48 px-4 py-3" scope="col">
							{t("jobsScreen.updated")}
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<For each={rows.jobs}>
						{(job) => (
							<TableRow
								class={
									props.selectedJobId === job.id
										? "bg-accent hover:bg-accent"
										: undefined
								}
								data-selected={props.selectedJobId === job.id}
							>
								<TableCell class="px-2 py-2 [&:has([role=checkbox])]:pr-2">
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
								</TableCell>
								<TableCell class="px-2 py-2">
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
								</TableCell>
								<TableCell class="px-2 py-2">
									<Button
										aria-label={t("jobsScreen.valueJobValue", {
											value0: String(jobTypeLabel(job.type)),
											value1: String(job.id),
										})}
										aria-pressed={props.selectedJobId === job.id}
										variant="ghost"
										class="h-auto w-full flex-col items-start gap-0 px-2 py-2 text-left"
										onClick={() => props.onSelect(job)}
										type="button"
									>
										<span
											class="max-w-full truncate"
											title={jobTypeLabel(job.type)}
										>
											{jobTypeLabel(job.type)}
										</span>
										<span class="mt-0.5 font-normal text-muted-foreground text-xs">
											{job.id.slice(0, 8)}
										</span>
									</Button>
								</TableCell>
								<TableCell class="px-4 py-3 whitespace-nowrap">
									<JobStatusBadge status={job.status} />
								</TableCell>
								<TableCell class="px-4 py-3">
									<JobProgress progress={job.progress} />
								</TableCell>
								<TableCell class="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
									{formatDate(job.updatedAt, { includeTime: true })}
								</TableCell>
							</TableRow>
						)}
					</For>
				</TableBody>
			</Table>
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
		<div class="mb-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 @2xl/jobs-list:flex-row @2xl/jobs-list:items-center @2xl/jobs-list:justify-between">
			<div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
				<Checkbox
					checked={props.allSelected}
					class="flex min-h-11 min-w-0 items-center gap-2 sm:min-h-9"
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
			<div class="flex flex-col gap-2 @2xs/jobs-list:flex-row @2xs/jobs-list:items-center @2xl/jobs-list:shrink-0">
				<Select<JobBulkAction>
					class="min-w-0 @2xs/jobs-list:flex-1 @2xl/jobs-list:w-52 @2xl/jobs-list:flex-none"
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
						class="gap-2 bg-card text-start sm:min-h-9"
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
					class="min-h-11 shrink-0 sm:min-h-9"
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

function BatchTargetThumbnail(props: {
	target: BatchTargets["items"][number];
	buildUrl: (args: BuildThumbnailUrlArgs) => string;
}) {
	const source = createMemo(() => {
		const { mediaId, mediaSourceId, mediaModifiedAt } = props.target;
		if (!mediaId || !mediaSourceId || !mediaModifiedAt) return undefined;
		return createHttpThumbnailSource({
			buildUrl: props.buildUrl,
			mediaId,
			mediaSourceId,
			modifiedAt: mediaModifiedAt,
			defaultSize: 256,
		});
	});
	return (
		<div
			class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
			aria-hidden="true"
		>
			<Show
				when={source()}
				fallback={<span class="text-xs text-muted-foreground">—</span>}
			>
				{(thumbnail) => (
					<ThumbnailImage
						alt=""
						fallback=""
						source={thumbnail()}
						class="size-12 object-cover"
						width={48}
						height={48}
						loading="lazy"
					/>
				)}
			</Show>
		</div>
	);
}

function BatchTargetList(props: {
	active: boolean;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	id: string;
	load: LoadTargets;
	upload?: (
		reservationId: string,
		filename: string,
		file: File,
	) => Promise<void>;
}) {
	const inputId = createUniqueId();
	const [page, setPage] = createSignal(1);
	const size = 25;
	const [submitting, setSubmitting] = createSignal<string>();
	const [inputError, setInputError] = createSignal<string>();
	const sendFile = async (
		reservation: string,
		filename: string,
		file: File,
	) => {
		if (!props.upload || submitting()) return;
		setSubmitting(reservation);
		setInputError(undefined);
		try {
			await props.upload(reservation, filename, file);
			await query.refetch();
		} catch {
			setInputError(t("index.uploadFailed"));
		} finally {
			setSubmitting(undefined);
		}
	};
	const query = createQuery(() => ({
		queryKey: [...jobsQueryKeys.targets(props.id), page()],
		queryFn: ({ signal }) =>
			props.load(props.id, (page() - 1) * size, size, signal),
	}));
	return (
		<section
			class="@container min-w-0 [&>div:has(table)]:overflow-visible"
			aria-label={t("jobsScreen.batchTargets")}
		>
			<Show when={inputError()}>
				{(error) => <p role="alert">{error()}</p>}
			</Show>
			<Show when={query.isPending}>
				<p role="status">{t("status.loading")}</p>
			</Show>
			<Show when={query.isError}>
				<Button variant="outline" onClick={() => void query.refetch()}>
					{t("actions.retry")}
				</Button>
			</Show>
			<Show when={query.data}>
				{(data) => (
					<>
						<Show when={data().stages}>
							{(stages) => (
								<ImportStageProgress stages={stages()} active={props.active} />
							)}
						</Show>
						<h3 class="mb-3 font-semibold text-base">
							{t("jobsScreen.batchTargets")}
						</h3>
						<Table class="table-fixed">
							<TableCaption class="sr-only">
								{t("jobsScreen.batchTargets")}
							</TableCaption>

							<TableHeader class="sticky top-0 z-10 bg-background">
								<TableRow>
									<TableHead class="w-16" scope="col">
										<span class="sr-only">{t("jobsScreen.targetMedia")}</span>
									</TableHead>
									<TableHead scope="col">{t("jobsScreen.target")}</TableHead>
									<TableHead class="hidden w-40 @xl:table-cell" scope="col">
										{t("jobsScreen.currentStage")}
									</TableHead>
									<TableHead class="w-28" scope="col">
										{t("jobsScreen.status")}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<For
									each={data().items}
									fallback={
										<TableRow>
											<TableCell colSpan={4}>
												{t("jobsScreen.noRecordedTargets")}
											</TableCell>
										</TableRow>
									}
								>
									{(item) => (
										<TableRow>
											<TableCell class="px-2">
												<BatchTargetThumbnail
													target={item}
													buildUrl={props.buildThumbnailUrl}
												/>
											</TableCell>
											<TableCell class="wrap-anywhere">
												<span class="block">{item.label}</span>
												<Show when={item.stage}>
													{(stage) => (
														<div class="mt-1 text-xs text-muted-foreground @xl:hidden">
															{jobTypeLabel(stage())}
														</div>
													)}
												</Show>
												<Show when={props.upload && item.uploadReservationId}>
													{(reservation) => (
														<Label for={`${inputId}-${reservation()}`}>
															{t("jobsScreen.chooseRetryFile", {
																filename: item.label,
															})}
															<Input
																type="file"
																id={`${inputId}-${reservation()}`}
																disabled={!!submitting()}
																onChange={(event) => {
																	const file = event.currentTarget.files?.[0];
																	event.currentTarget.value = "";
																	if (file)
																		void sendFile(
																			reservation(),
																			item.label,
																			file,
																		);
																}}
															/>
														</Label>
													)}
												</Show>
											</TableCell>
											<TableCell class="hidden text-xs text-muted-foreground @xl:table-cell">
												{item.stage ? jobTypeLabel(item.stage) : "—"}
											</TableCell>
											<TableCell>
												{item.skipped ? (
													t("jobsScreen.skipped")
												) : (
													<Show
														when={item.status}
														fallback={t("jobsScreen.itemOutcomeUnavailable")}
													>
														{(status) => <JobStatusBadge status={status()} />}
													</Show>
												)}
											</TableCell>
										</TableRow>
									)}
								</For>
							</TableBody>
						</Table>
						<Show when={data().total > size}>
							<PaginationControls
								currentPage={page()}
								totalPages={Math.ceil(data().total / size)}
								onPageChange={setPage}
							/>
						</Show>
					</>
				)}
			</Show>
		</section>
	);
}

function JobsInspector(props: {
	loadTargets?: LoadTargets;
	onUploadTarget?: (
		sourceId: string,
		reservationId: string,
		filename: string,
		file: File,
	) => Promise<unknown>;
	buildThumbnailUrl: (args: BuildThumbnailUrlArgs) => string;
	onBack: () => void;
	job: JobDto | undefined;
	onCancel: (jobId: string) => void | Promise<void>;
	onDownload: (job: JobDto) => void | Promise<void>;
	onRetry: (
		jobId: string,
		replacementUploadId?: string,
	) => void | Promise<void>;
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
			job.cancelRequestedAt ||
			!canCancelJobType(job.type) ||
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
			class="flex h-full min-h-0 min-w-0 flex-col bg-background"
		>
			<Show when={props.job}>
				{(job) => (
					<>
						<header class="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6">
							<Button
								variant="ghost"
								size="sm"
								class="mb-2 -ml-2 min-h-11 sm:min-h-8"
								onClick={props.onBack}
							>
								<ArrowLeft aria-hidden="true" size={16} />
								{t("jobsScreen.backToList")}
							</Button>
							<div class="flex flex-wrap items-center justify-between gap-2">
								<h2 class="font-semibold text-xl">
									{jobTypeLabel(job().type)}
								</h2>
								<JobStatusBadge status={job().status} />
							</div>
							<Show when={job().progress}>
								{(progress) => (
									<div class="mt-4">
										<p class="mb-2 text-xs text-muted-foreground">
											{t("jobsScreen.progress")}
										</p>
										<JobProgress progress={progress()} />

										<Show when={progress().cancelled}>
											<p>
												{t("jobsScreen.cancelledCount", {
													count: String(progress().cancelled),
												})}
											</p>
										</Show>
									</div>
								)}
							</Show>

							<Show when={job().progress}>
								{(progress) => (
									<p class="mt-2 text-xs text-muted-foreground">
										{t("jobsScreen.batchSummary", {
											completed: String(progress().processed),
											failed: String(progress().failed),
											remaining: String(
												Math.max(
													0,
													progress().total -
														progress().processed -
														progress().failed -
														(progress().cancelled ?? 0),
												),
											),
										})}
									</p>
								)}
							</Show>
							<div class="mt-4 flex flex-wrap gap-2">
								<Show when={job().artifact}>
									{(artifact) => (
										<Button
											aria-busy={isDownloading()}
											variant="outline"
											class="h-auto max-w-full justify-start px-3 py-2 text-primary"
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
										</Button>
									)}
								</Show>

								<div class="flex flex-wrap gap-2">
									<Show
										fallback={null}
										when={
											(job().status === "pending" ||
												job().status === "in_progress") &&
											canCancelJobType(job().type)
										}
									>
										<Button
											aria-busy={isCancelling()}
											class="min-h-11 w-full sm:min-h-9 sm:w-auto"
											disabled={isCancelling() || !!job().cancelRequestedAt}
											onClick={() => void cancel()}
											variant="outline"
										>
											<Ban aria-hidden="true" size={15} />
											{isCancelling() || job().cancelRequestedAt
												? t("jobsScreen.cancelling")
												: job().type === "import_batch_parent"
													? t("jobsScreen.cancelImportBatch")
													: t("jobsScreen.cancelJob")}
										</Button>
									</Show>
									<Show when={canRetryJob(job())}>
										<Button
											aria-busy={isRetrying()}
											class="min-h-11 w-full sm:min-h-9 sm:w-auto"
											disabled={isRetrying()}
											onClick={() => void retry()}
											variant="outline"
										>
											<RotateCcw aria-hidden="true" size={15} />
											{isRetrying()
												? t("status.retrying")
												: hasBatchTargetHistory(job().type)
													? t("jobsScreen.retryFailedStages")
													: t("jobsScreen.retryJob")}
										</Button>
									</Show>
								</div>
							</div>
						</header>
						<ManagementScrollArea class={MANAGEMENT_CONTENT_PADDING}>
							<Show when={job().error}>
								{(error) => (
									<Alert class="mt-3" variant="destructive">
										<CircleAlert aria-hidden="true" size={16} />
										<AlertDescription class="break-words">
											{error()}
										</AlertDescription>
									</Alert>
								)}
							</Show>

							<Show when={job().cancelRequestedAt}>
								<Callout class="mt-3" variant="warning">
									<CalloutContent class="mt-0 text-xs">
										{t("jobsScreen.cancellationRequestedAtValue", {
											value0: String(formatDate(job().cancelRequestedAt)),
										})}
									</CalloutContent>
								</Callout>
							</Show>

							<Show
								when={
									(isBatchParentJobType(job().type) ||
										job().type === "extract_embedding_batch") &&
									job().id
								}
								keyed
							>
								{(id) => (
									<Show when={props.loadTargets}>
										{(load) => (
											<BatchTargetList
												active={
													job().status === "pending" ||
													job().status === "in_progress"
												}
												buildThumbnailUrl={props.buildThumbnailUrl}
												id={id}
												load={load()}
												upload={
													props.onUploadTarget &&
													job().mediaSourceId &&
													(!job().cancelRequestedAt || canRetryJob(job()))
														? async (reservation, filename, file) => {
																const source = job().mediaSourceId;
																const upload = props.onUploadTarget;
																if (!source || !upload) return;
																if (canRetryJob(job()))
																	await props.onRetry(id, reservation);
																await upload(
																	source,
																	reservation,
																	filename,
																	file,
																);
															}
														: undefined
												}
											/>
										)}
									</Show>
								)}
							</Show>
							<Show when={job().targetMediaId && job().mediaSourceId}>
								<div class="mt-4 overflow-hidden rounded-md border border-border bg-card">
									<JobThumbnail
										alt={t("jobsScreen.targetMediaForValueJob", {
											value0: String(jobTypeLabel(job().type)),
										})}
										buildUrl={props.buildThumbnailUrl}
										class="max-h-64 w-full object-contain"
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

							<Collapsible class="mt-6 border-t border-border pt-4">
								<CollapsibleTrigger class="group flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
									{t("jobsScreen.executionInfo")}
									<ChevronDown
										aria-hidden="true"
										size={16}
										class="group-data-[expanded]:rotate-180"
									/>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<dl class="mt-3 grid gap-3 text-xs sm:grid-cols-2">
										<div class="flex justify-between gap-3">
											<dt class="text-muted-foreground">
												{t("jobsScreen.status")}
											</dt>
											<dd class="text-right text-muted-foreground">
												{statusLabel(job().status)}
											</dd>
										</div>
										<div class="flex justify-between gap-3">
											<dt class="text-muted-foreground">
												{t("labels.source")}
											</dt>
											<dd class="min-w-0 break-all text-right text-muted-foreground">
												{job().mediaSourceId ?? "—"}
											</dd>
										</div>
										<div class="flex justify-between gap-3">
											<dt class="text-muted-foreground">
												{t("jobsScreen.created")}
											</dt>
											<dd class="text-right text-muted-foreground">
												{formatDate(job().createdAt, { includeTime: true })}
											</dd>
										</div>
										<div class="flex justify-between gap-3">
											<dt class="text-muted-foreground">
												{t("jobsScreen.updated")}
											</dt>
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
											<dt class="text-muted-foreground">
												{t("jobsScreen.started")}
											</dt>
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
											<dt class="text-muted-foreground">
												{t("jobsScreen.target")}
											</dt>
											<dd class="min-w-0 break-all text-right text-muted-foreground">
												{job().targetMediaId ?? "—"}
											</dd>
										</div>
										<div class="flex justify-between gap-3">
											<dt class="text-muted-foreground">
												{t("jobsScreen.jobID")}
											</dt>
											<dd class="min-w-0 break-all text-right text-muted-foreground">
												{job().id}
											</dd>
										</div>
									</dl>
								</CollapsibleContent>
							</Collapsible>
						</ManagementScrollArea>
					</>
				)}
			</Show>
		</aside>
	);
}

function JobsLoadMore(props: {
	screen: JobsScreenProps;
	root: Accessor<HTMLDivElement | undefined>;
}) {
	const [boundary, setBoundary] = createSignal<HTMLDivElement>();
	observePageBoundary({
		target: boundary,
		root: props.root,
		enabled: () =>
			props.screen.hasMore() &&
			!props.screen.isRefreshing() &&
			!props.screen.isLoadingMore() &&
			!props.screen.loadMoreError(),
		rootMargin: "200px",
		load: props.screen.onLoadMore,
	});
	return (
		<div
			ref={setBoundary}
			class="mt-4 flex min-h-11 flex-col items-center gap-2"
		>
			<Show when={props.screen.loadMoreError()}>
				<Alert variant="destructive">
					<AlertDescription>{t("jobsScreen.loadMoreFailed")}</AlertDescription>
				</Alert>
			</Show>
			<Show when={props.screen.hasMore()}>
				<Button
					class="min-h-11 sm:min-h-9"
					variant="outline"
					onClick={props.screen.onLoadMore}
					disabled={props.screen.isLoadingMore()}
					aria-busy={props.screen.isLoadingMore()}
				>
					{props.screen.isLoadingMore()
						? t("jobsScreen.loadingJobs")
						: props.screen.loadMoreError()
							? t("actions.retry")
							: t("actions.loadMore")}
				</Button>
			</Show>
		</div>
	);
}

export function JobsScreen(props: JobsScreenProps) {
	const activeFilter = () => props.status() ?? "all";
	const isUnfiltered = () => activeFilter() === "all" && !props.type();
	const resultsPanelId = `jobs-results-${createUniqueId()}`;
	const [scrollRoot, setScrollRoot] = createSignal<HTMLDivElement>();
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
	const [detailOpen, setDetailOpen] = createSignal(false);

	const selectJob = (job: JobDto) => {
		setDetailOpen(true);
		if (props.inspection) props.inspection.select(job.id);
		else setLocalSelection(job.id);
	};
	const selectedId = createMemo(() => selectedJob()?.id);
	createEffect(() => {
		if (selectedId()) setDetailOpen(true);
	});
	const retryableJobIds = createMemo(() => getRetryableJobIds(props.jobs()));
	const selectedRetryableJobIds = createMemo(() =>
		retryableJobIds().filter((jobId) => selectedJobIds().has(jobId)),
	);
	const clearBulkSelection = () => {
		setSelectedJobIds(new Set<string>());
		setBulkAction(null);
	};
	const changeStatus = (value: string) => {
		const filter = JOB_FILTERS.find((filter) => filter.value === value);
		if (!filter) return;
		props.onStatusChange(filter.value === "all" ? undefined : filter.value);
		scrollRoot()?.scrollTo({ top: 0 });
		clearBulkSelection();
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
		<ManagementScreen
			header={
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
								class="min-h-11 sm:min-h-8"
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
			}
		>
			<div
				class={
					detailOpen() && selectedJob()
						? "grid min-h-0 min-w-0 flex-1 lg:grid-cols-jobs-inspector"
						: "grid min-h-0 min-w-0 flex-1"
				}
			>
				<ManagementScrollArea
					ref={setScrollRoot}
					class={
						detailOpen() && selectedJob()
							? "hidden border-r border-border px-3 py-4 sm:px-4 lg:block"
							: MANAGEMENT_CONTENT_PADDING
					}
				>
					<Show when={props.inspection?.failed()}>
						<ErrorState
							title={t("jobsScreen.couldNotLoadTheSelectedJob")}
							description={t(
								"jobsScreen.reloadTheJobOrSelectAnotherOneFromThe",
							)}
							onRetry={() => props.inspection?.retry()}
						/>
					</Show>
					<div class="mb-4 flex flex-wrap items-end gap-2">
						<Select<string>
							class={`min-w-0 flex-1 basis-32 ${detailOpen() ? "" : "sm:max-w-64"}`}
							placeholder={t("jobsScreen.allTypes")}
							options={["", ...(props.jobTypes().data ?? [])]}
							value={props.type() ?? ""}
							onChange={(type) => {
								props.onTypeChange(type || undefined);
								clearBulkSelection();
								scrollRoot()?.scrollTo({ top: 0 });
							}}
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue
										? jobTypeLabel(itemProps.item.rawValue)
										: t("jobsScreen.allTypes")}
								</SelectItem>
							)}
						>
							<SelectTrigger
								aria-label={t("jobsScreen.jobTypeFilter")}
								class="min-h-11 gap-2 bg-card text-start sm:min-h-9"
							>
								<SelectValue<string>>
									{(state) => {
										const selected = state.selectedOption();
										return selected
											? jobTypeLabel(selected)
											: t("jobsScreen.allTypes");
									}}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<Select<(typeof JOB_FILTERS)[number]>
							class={`min-w-0 flex-1 basis-32 ${detailOpen() ? "" : "sm:max-w-64 lg:hidden"}`}
							disallowEmptySelection
							options={[...JOB_FILTERS]}
							optionTextValue="label"
							optionValue="value"
							value={JOB_FILTERS.find(
								(filter) => filter.value === activeFilter(),
							)}
							onChange={(filter) => {
								if (filter) changeStatus(filter.value);
							}}
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue.label}
								</SelectItem>
							)}
						>
							<SelectTrigger
								aria-label={t("jobsScreen.jobStatusFilter")}
								class="min-h-11 gap-2 bg-card text-start sm:min-h-9"
							>
								<SelectValue<(typeof JOB_FILTERS)[number]>>
									{(state) =>
										activeFilter() === "all"
											? t("jobsScreen.allStatuses")
											: state.selectedOption()?.label
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<Show when={props.jobTypes().error}>
							<Button
								class="min-h-11 sm:min-h-9"
								onClick={props.onRetryTypes}
								variant="outline"
							>
								{t("jobsScreen.retryTypes")}
							</Button>
						</Show>
					</div>
					<Tabs
						class={detailOpen() ? "grid gap-4" : MANAGEMENT_CATEGORY_GRID}
						onChange={changeStatus}
						value={activeFilter()}
					>
						<TabsList
							aria-label={t("jobsScreen.jobStatusFilter")}
							class={`hidden h-auto justify-start gap-1 rounded-none bg-transparent p-0 ${detailOpen() ? "" : `${MANAGEMENT_CATEGORY_LIST} lg:flex lg:flex-col`}`}
						>
							<For each={JOB_FILTERS}>
								{(filter) => {
									const Icon = filter.icon;
									return (
										<TabsTrigger
											aria-controls={resultsPanelId}
											class="min-h-10 w-full justify-start gap-2.5 rounded-md px-2.5 text-muted-foreground shadow-none data-[selected]:bg-accent data-[selected]:text-primary"
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
						<TabsContent
							class="@container/jobs-list mt-0 min-w-0"
							forceMount
							id={resultsPanelId}
							value={activeFilter()}
						>
							<Switch>
								<Match when={props.state().phase === "pending"}>
									<LoadingRegion label={t("jobsScreen.loadingJobs")}>
										<div class="h-64 rounded-md border border-border bg-card" />
									</LoadingRegion>
								</Match>
								<Match when={props.state().phase === "error"}>
									<ErrorState
										description={t("jobsScreen.checkYourConnectionAndTryAgain")}
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
													isUnfiltered()
														? "jobsScreen.newJobsAndTheirStatusWillAppearHere"
														: "jobsScreen.adjustFiltersToSeeJobs",
												)}
												icon={<Clock3 size={20} />}
												title={t(
													isUnfiltered()
														? "jobsScreen.noJobsYet"
														: "jobsScreen.noMatchingJobs",
												)}
											/>
										}
										when={props.jobs().length > 0}
									>
										<Show when={retryableJobIds().length > 0}>
											<JobsBulkActions
												action={bulkAction()}
												allSelected={
													selectedRetryableJobIds().length ===
													retryableJobIds().length
												}
												hasSelection={selectedRetryableJobIds().length > 0}
												isApplying={isApplyingBulkAction()}
												onActionChange={setBulkAction}
												onApply={applyBulkAction}
												onToggleAll={toggleAllJobs}
												selectableCount={retryableJobIds().length}
												selectedCount={selectedRetryableJobIds().length}
											/>
										</Show>
										<JobsTable
											compact={detailOpen()}
											buildThumbnailUrl={props.buildThumbnailUrl}
											jobs={props.jobs()}
											onSelect={selectJob}
											onToggleSelect={toggleJob}
											selectedJobId={selectedId() ?? null}
											selectedJobIds={selectedJobIds()}
										/>
									</Show>
									<Show when={props.jobs().length > 0}>
										<p
											class="mt-3 text-xs text-muted-foreground"
											aria-live="polite"
										>
											{t("jobsScreen.showingValueValueOfValueValueJobs", {
												value1: props.jobs().length.toLocaleString(),
												value3: (
													props.state().data?.total ?? 0
												).toLocaleString(),
											})}
										</p>
									</Show>
									<JobsLoadMore screen={props} root={scrollRoot} />
								</Match>
							</Switch>
						</TabsContent>
					</Tabs>
				</ManagementScrollArea>

				<Show when={detailOpen() && selectedJob()}>
					<JobsInspector
						loadTargets={props.loadTargets}
						onUploadTarget={props.onUploadTarget}
						buildThumbnailUrl={props.buildThumbnailUrl}
						job={selectedJob()}
						onBack={() => {
							setDetailOpen(false);
							queueMicrotask(() =>
								scrollRoot()
									?.querySelector<HTMLButtonElement>(
										"button[aria-pressed=true]",
									)
									?.focus({ preventScroll: true }),
							);
						}}
						onCancel={props.onCancel}
						onDownload={props.onDownload}
						onRetry={props.onRetry}
					/>
				</Show>
			</div>
		</ManagementScreen>
	);
}
