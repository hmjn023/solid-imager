import { Show } from "solid-js";
import { Badge } from "../../badge";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Progress } from "../../progress";

export function ManagerJobStatus(props: { manager: UseManagerPageResult }) {
	return (
		<Show when={props.manager.taggingStatus() || props.manager.jobProgress()}>
			<section
				aria-live="polite"
				class="space-y-3 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-4"
			>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h3 class="font-medium text-sm">Current run</h3>
					<Badge variant="secondary">
						{props.manager.activeJobId() ? "Running" : "Status"}
					</Badge>
				</div>
				<p class="text-xs text-[var(--v2-text-secondary)]">
					{props.manager.taggingStatus()}
				</p>
				<Show when={props.manager.jobProgress()}>
					{(progress) => (
						<div class="space-y-2">
							<div class="flex justify-between text-xs text-[var(--v2-text-muted)]">
								<span>Progress</span>
								<span>
									{progress().processed} / {progress().total}
								</span>
							</div>
							<Progress
								class="h-2"
								value={
									progress().total > 0
										? (progress().processed / progress().total) * 100
										: 0
								}
							/>
						</div>
					)}
				</Show>
			</section>
		</Show>
	);
}
