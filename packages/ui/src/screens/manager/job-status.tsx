import type { JobDto } from "@solid-imager/core/jobs";
import { For, Show } from "solid-js";
import { Badge } from "../../badge";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Progress } from "../../progress";

export function ManagerJobStatus(props: { manager: UseManagerPageResult }) {
	return (
		<Show when={props.manager.taggingStatus() || props.manager.jobProgress()}>
			<section
				aria-live="polite"
				class="space-y-3 rounded-md border border-border bg-card p-4"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-medium text-sm">Current run</h3>
					<Badge variant="secondary">
						{props.manager.jobStatus() === "completed"
							? "Completed"
							: props.manager.jobStatus() === "failed"
								? "Failed"
								: props.manager.jobStatus() === "cancelled"
									? "Cancelled"
									: props.manager.jobStatus() === "pending"
										? "Queued"
										: props.manager.activeJobId()
											? "Running"
											: "Status"}
					</Badge>
				</div>
				<p class="text-xs text-muted-foreground">
					{props.manager.taggingStatus()}
				</p>
				<Show
					when={props.manager.jobProgress()}
					fallback={
						<Show when={props.manager.activeJobId()}>
							<p class="text-xs text-muted-foreground">
								Preparing target count...
							</p>
						</Show>
					}
				>
					{(progress) => (
						<BatchCounts
							progress={{ ...progress(), failed: progress().failed ?? 0 }}
							label="Batch progress"
						/>
					)}
				</Show>
			</section>
		</Show>
	);
}

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
				<p class="text-xs text-muted-foreground">Preparing target count...</p>
			}
		>
			<div class="space-y-2">
				<div class="flex justify-between text-xs text-muted-foreground">
					<span>Progress</span>
					<span>
						{done()} / {props.progress.total} ({Math.round(percentage())}%)
					</span>
				</div>
				<Progress class="h-2" aria-label={props.label} value={percentage()} />
				<Show when={props.progress.failed}>
					<p class="text-xs text-destructive">{props.progress.failed} failed</p>
				</Show>
			</div>
		</Show>
	);
}

const batchLabels: Record<string, string> = {
	batch_ccip_parent: "CCIP extraction",
	bulk_tagging_parent: "Batch tagging",
	extract_embedding_batch: "EmbeddingGemma 2 extraction",
	thumbnail_generation_parent: "Thumbnail generation",
};

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
							{job.status === "pending" ? "Queued" : "Running"}
						</Badge>
					</div>
					<p class="text-xs text-muted-foreground">
						{props.manager
							.sources()
							.find((source) => source.id === job.mediaSourceId)?.name ??
							(job.mediaSourceId || "All sources")}
					</p>
					<Show
						when={job.progress}
						fallback={
							<p class="text-xs text-muted-foreground">
								Preparing target count...
							</p>
						}
					>
						{(progress) => (
							<BatchCounts
								progress={progress()}
								label={batchLabels[job.type] + " progress"}
							/>
						)}
					</Show>
				</section>
			)}
		</For>
	);
}
