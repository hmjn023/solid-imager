import { Show } from "solid-js";
import { Badge } from "../../badge";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Progress } from "../../progress";

export function ManagerJobStatus(props: { manager: UseManagerPageResult }) {
	const completed = () => {
		const progress = props.manager.jobProgress();
		return (progress?.processed ?? 0) + (progress?.failed ?? 0);
	};
	const percentage = () => {
		const total = props.manager.jobProgress()?.total ?? 0;
		return total > 0
			? Math.min(100, Math.max(0, (completed() / total) * 100))
			: 0;
	};
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
						<div class="space-y-2">
							<div class="flex justify-between text-xs text-muted-foreground">
								<span>Progress</span>
								<span>
									{completed()} / {progress().total}
									<Show when={progress().total > 0}>
										{" "}
										({Math.round(percentage())}%)
									</Show>
								</span>
							</div>
							<Show
								when={progress().total > 0}
								fallback={
									<Show when={props.manager.activeJobId()}>
										<p class="text-xs text-muted-foreground">
											Preparing target count...
										</p>
									</Show>
								}
							>
								<Progress
									class="h-2"
									aria-label="Batch progress"
									value={percentage()}
								/>
							</Show>
							<Show when={progress().failed}>
								<p class="text-xs text-destructive">
									{progress().failed} failed
								</p>
							</Show>
						</div>
					)}
				</Show>
			</section>
		</Show>
	);
}
