import { createSignal } from "solid-js";
import { Button } from "../../button";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Label } from "../../label";
import { ManagerJobStatus } from "./job-status";
import { SourceSelect } from "./source-select";

export function ThumbnailWarmupPanel(props: { manager: UseManagerPageResult }) {
	const [isStarting, setIsStarting] = createSignal(false);
	const startWarmup = async () => {
		if (isStarting() || props.manager.activeJobId()) return;
		setIsStarting(true);
		try {
			await props.manager.handleStartThumbnailWarmup();
		} finally {
			setIsStarting(false);
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					Thumbnail warmup
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					Generate missing 256px grid thumbnails without replacing existing
					512px previews.
				</p>
			</div>

			<section class="border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4">
				<div class="space-y-1.5">
					<Label>Target source</Label>
					<SourceSelect
						manager={props.manager}
						onChange={props.manager.setSelectedSourceId}
						placeholder="Select source"
						value={props.manager.selectedSourceId()}
					/>
					<p class="text-xs text-[var(--v2-text-muted)]">
						Only missing 256px variants are queued. Select one source to keep
						the operation bounded.
					</p>
				</div>
				<div class="mt-4 flex justify-end border-[var(--v2-border)] border-t pt-4">
					<Button
						class="w-full sm:w-auto"
						disabled={
							isStarting() ||
							!!props.manager.activeJobId() ||
							!props.manager.selectedSourceId()
						}
						onClick={() => void startWarmup()}
					>
						{isStarting() ? "Submitting..." : "Warm missing thumbnails"}
					</Button>
				</div>
			</section>

			<ManagerJobStatus manager={props.manager} />
		</div>
	);
}
