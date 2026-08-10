import type {
	JobDto,
	JobListResponse,
} from "@solid-imager/core/domain/jobs/schemas";
import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import Clock3 from "lucide-solid/icons/clock-3";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import type { Accessor } from "solid-js";
import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js";
import { EmptyState, ErrorState, OfflineState } from "../async-state";
import { Badge } from "../badge";
import { Button } from "../button";
import type { QueryUiState } from "../query-state";
import { LoadingRegion } from "../skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import {
	V2_CATEGORY_TABS_CLASS,
	V2CategoryLabel,
	V2ManagementHeader,
} from "../v2/management-layout";

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
] as const;

type JobFilter = (typeof JOB_FILTERS)[number]["value"];

export type V2JobsScreenProps = {
	isRefreshing: Accessor<boolean>;
	jobs: Accessor<JobDto[]>;
	onRefresh: () => void | Promise<void>;
	onRetry: (jobId: string) => void | Promise<void>;
	state: Accessor<QueryUiState<JobListResponse>>;
};

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
	dateStyle: "medium",
	timeStyle: "short",
});

function formatDate(value: Date): string {
	return dateFormatter.format(value);
}

function jobTypeLabel(type: string): string {
	return type
		.replaceAll("_", " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusLabel(status: JobDto["status"]): string {
	return {
		completed: "Completed",
		failed: "Failed",
		in_progress: "In progress",
		pending: "Pending",
	}[status];
}

function statusClass(status: JobDto["status"]): string {
	return {
		completed:
			"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
		failed:
			"border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
		in_progress:
			"border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
		pending:
			"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
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
	selectedJobId: string | null;
}) {
	return (
		<div class="overflow-hidden rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)]">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[48rem] text-left text-sm">
					<thead class="border-[var(--v2-border)] border-b bg-[var(--v2-surface-muted)] text-xs uppercase tracking-wide">
						<tr>
							<th class="px-4 py-3 font-medium">Type</th>
							<th class="px-4 py-3 font-medium">Status</th>
							<th class="px-4 py-3 font-medium">Progress</th>
							<th class="px-4 py-3 font-medium">Updated</th>
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
										<button
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
										{formatDate(job.updatedAt)}
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

function JobsInspector(props: {
	class?: string;
	job: JobDto | undefined;
	onRetry: (jobId: string) => void | Promise<void>;
}) {
	const [isRetrying, setIsRetrying] = createSignal(false);

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
									{formatDate(job().createdAt)}
								</dd>
							</div>
							<div class="flex justify-between gap-3">
								<dt class="text-[var(--v2-text-muted)]">Updated</dt>
								<dd class="text-right text-[var(--v2-text-secondary)]">
									{formatDate(job().updatedAt)}
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
								<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
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

						<div class="mt-5 space-y-2">
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
			default:
				return jobs;
		}
	});
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
						onChange={(value) => setActiveFilter(value as JobFilter)}
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
														<JobsTable
															jobs={filteredJobs()}
															onSelect={(job) => setSelectedJobId(job.id)}
															selectedJobId={selectedJobId()}
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
																	onRetry={props.onRetry}
																/>
															)}
														</Show>
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

				<JobsInspector job={selectedJob()} onRetry={props.onRetry} />
			</div>
		</section>
	);
}
