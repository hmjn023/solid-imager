import { t } from "@solid-imager/i18n";
import type { JobDto } from "@solid-imager/core/jobs";
import { For, Show } from "solid-js";
import { Badge } from "../../badge";
import { Button } from "../../button";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Progress } from "../../progress";

/** Shows the locally tracked run’s progress and terminal status in its batch tool. */
export function ManagerJobStatus(props: { manager: UseManagerPageResult }) {
	return (
		<Show when={props.manager.taggingStatus() || props.manager.jobProgress()}>
			<section
				aria-live="polite"
				class="space-y-3 rounded-md border border-border bg-card p-4"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-medium text-sm">
						{props.manager.batchDisplayKind() === "scan"
							? t("jobStatus.targetScan")
							: props.manager.batchDisplayKind() === "start"
								? t("jobStatus.batchRequest")
								: t("jobStatus.currentRun")}
					</h3>
					<Badge variant="secondary">
						{props.manager.batchDisplayKind() === "scan"
							? t("jobStatus.scan")
							: props.manager.batchDisplayKind() === "start"
								? t("jobStatus.request")
								: props.manager.jobStatus() === "completed"
									? t("status.completed")
									: props.manager.jobStatus() === "failed"
										? t("status.failed")
										: props.manager.jobStatus() === "cancelled"
											? t("status.cancelled")
											: props.manager.jobStatus() === "pending"
												? t("status.queued")
												: props.manager.jobStatus() === "in_progress"
													? t("status.running")
													: t("jobsScreen.status")}
					</Badge>
				</div>
				<p class="text-xs text-muted-foreground">
					{props.manager.taggingStatus()}
				</p>
				<Show
					when={props.manager.jobProgress()}
					fallback={
						<Show
							when={
								props.manager.batchDisplayKind() === "run" &&
								(props.manager.jobStatus() === "pending" ||
									props.manager.jobStatus() === "in_progress")
							}
						>
							<p class="text-xs text-muted-foreground">
								{t("jobStatus.preparingTargetCount")}
							</p>
						</Show>
					}
				>
					{(progress) => (
						<BatchCounts
							progress={{ ...progress(), failed: progress().failed ?? 0 }}
							label={t("jobStatus.batchProgress")}
						/>
					)}
				</Show>
			</section>
		</Show>
	);
}

/** Displays successful and failed items together as progress toward the server total. Shows a preparation message until a positive total is available. */
function BatchCounts(props: {
	progress: NonNullable<JobDto["progress"]>;
	label: string;
}) {
	const done = () => props.progress.processed + props.progress.failed;
	const percentage = () => (done() / props.progress.total) * 100;
	return (
		<Show
			when={props.progress.total > 0}
			fallback={
				<p class="text-xs text-muted-foreground">
					{t("jobStatus.preparingTargetCount")}
				</p>
			}
		>
			<div class="space-y-2">
				<div class="flex justify-between text-xs text-muted-foreground">
					<span>{t("jobsScreen.progress")}</span>
					<span>
						{done()} / {props.progress.total} ({Math.round(percentage())}%)
					</span>
				</div>
				<Progress class="h-2" aria-label={props.label} value={percentage()} />
				<Show when={props.progress.failed}>
					<p class="text-xs text-destructive">
						{t("jobStatus.valueFailed", {
							value0: String(props.progress.failed),
						})}
					</p>
				</Show>
			</div>
		</Show>
	);
}

const batchLabels: Record<string, string> = {
	batch_ccip_parent: t("jobTypes.extract_ccip_vector"),
	bulk_tagging_parent: t("jobTypes.bulk_tagging_parent"),
	extract_embedding_batch: t("jobTypes.extract_embedding_vector"),
	thumbnail_generation_parent: t("jobTypes.thumbnail_generation_parent"),
};

/** Displays the source, status and item counts of active batches returned by the server. */
export function ServerBatchStatus(props: {
	jobs: JobDto[];
	manager: UseManagerPageResult;
}) {
	return (
		<For each={props.jobs}>
			{(job) => (
				<section
					aria-label={batchLabels[job.type]}
					class="mb-3 space-y-2 rounded-md border border-border bg-card p-4"
				>
					<div class="flex items-center justify-between gap-2">
						<h3 class="font-medium text-sm">{batchLabels[job.type]}</h3>
						<Badge variant="secondary">
							{job.status === "pending"
								? t("status.queued")
								: t("status.running")}
						</Badge>
					</div>
					<p class="text-xs text-muted-foreground">
						{props.manager
							.sources()
							.find((source) => source.id === job.mediaSourceId)?.name ??
							(job.mediaSourceId || t("labels.allSources"))}
					</p>
					<Show
						when={job.progress}
						fallback={
							<p class="text-xs text-muted-foreground">
								{t("jobStatus.preparingTargetCount")}
							</p>
						}
					>
						{(progress) => (
							<BatchCounts
								progress={progress()}
								label={batchLabels[job.type] + t("jobStatus.progress")}
							/>
						)}
					</Show>
					<Button
						size="sm"
						variant="outline"
						onClick={() => props.manager.trackBatchJob(job)}
					>
						{t("jobStatus.trackProgress")}
					</Button>
				</section>
			)}
		</For>
	);
}
