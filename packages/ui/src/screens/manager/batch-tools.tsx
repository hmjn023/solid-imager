import { createSignal } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Label } from "../../label";
import { ManagerJobStatus } from "./job-status";
import { SourceSelect } from "./source-select";

export function BatchToolPanel(props: {
	kind: "tagging" | "vectors";
	manager: UseManagerPageResult;
}) {
	const [pendingAction, setPendingAction] = createSignal<
		"scan" | "start" | null
	>(null);
	const isVector = () => props.kind === "vectors";
	const runScan = async () => {
		if (pendingAction()) return;
		setPendingAction("scan");
		try {
			await props.manager.handleScan();
		} finally {
			setPendingAction(null);
		}
	};
	const runStart = async () => {
		if (pendingAction()) return;
		setPendingAction("start");
		try {
			if (isVector()) {
				await props.manager.handleStartBatchCcipExtraction();
			} else {
				await props.manager.handleStartBatchTagging();
			}
		} finally {
			setPendingAction(null);
		}
	};

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-[var(--v2-text)]">
					{isVector() ? "Vector extraction" : "Batch tagging"}
				</h2>
				<p class="mt-0.5 text-xs text-[var(--v2-text-muted)]">
					{isVector()
						? "Create CCIP character embeddings for similarity search."
						: "Analyze media and submit AI tagging jobs."}
				</p>
			</div>

			<section
				aria-labelledby={`${props.kind}-options-title`}
				class="border-[var(--v2-border)] border-y bg-[var(--v2-surface)] py-4 sm:rounded-md sm:border sm:p-4"
			>
				<h3 class="sr-only" id={`${props.kind}-options-title`}>
					Job options
				</h3>
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="space-y-1.5">
						<Label>Target source</Label>
						<SourceSelect
							manager={props.manager}
							onChange={props.manager.setSelectedSourceId}
							value={props.manager.selectedSourceId()}
						/>
						<p class="text-xs text-[var(--v2-text-muted)]">
							Leave empty to process all sources.
						</p>
					</div>
					<div class="space-y-2">
						<Label>Existing results</Label>
						<Checkbox
							checked={props.manager.forceRetag()}
							class="flex min-h-9 items-center gap-2"
							onChange={props.manager.setForceRetag}
						>
							<CheckboxControl />
							<CheckboxLabel>
								{isVector() ? "Force re-extraction" : "Force re-tagging"}
							</CheckboxLabel>
						</Checkbox>
						<p class="text-xs text-[var(--v2-text-muted)]">
							When disabled, processed media is skipped.
						</p>
					</div>
				</div>
				<div class="mt-4 flex flex-col justify-end gap-2 border-[var(--v2-border)] border-t pt-4 sm:flex-row">
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void runScan()}
						variant="outline"
					>
						{pendingAction() === "scan" ? "Scanning..." : "Scan targets"}
					</Button>
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void runStart()}
					>
						{pendingAction() === "start"
							? "Submitting..."
							: isVector()
								? "Start extraction"
								: "Start tagging"}
					</Button>
				</div>
			</section>

			<ManagerJobStatus manager={props.manager} />
		</div>
	);
}
