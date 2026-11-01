import { createSignal, Show } from "solid-js";
import { Button } from "../../button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "../../checkbox";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Label } from "../../label";
import { ManagerJobStatus } from "./job-status";
import { SourceSelect } from "./source-select";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../select";

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
				<h2 class="font-semibold text-lg text-foreground">
					{isVector() ? "Vector extraction" : "Batch tagging"}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{isVector()
						? "Create EmbeddingGemma 2 image embeddings for image and natural language search, or CCIP character embeddings."
						: "Analyze media and submit AI tagging jobs."}
				</p>
			</div>

			<section
				aria-labelledby={`${props.kind}-options-title`}
				class="border-border border-y bg-card py-4 sm:rounded-md sm:border sm:p-4"
			>
				<h3 class="sr-only" id={`${props.kind}-options-title`}>
					Job options
				</h3>
				<div class="grid gap-4 lg:grid-cols-2">
					<Show when={isVector()}>
						<div class="space-y-1.5">
							<Label for="batch-vector-model">Model</Label>
							<Select
								options={["embeddinggemma2", "ccip"]}
								value={props.manager.vectorModel()}
								disabled={
									pendingAction() !== null || !!props.manager.activeJobId()
								}
								onChange={(value) =>
									props.manager.setVectorModel(
										value === "ccip" ? "ccip" : "embeddinggemma2",
									)
								}
								itemComponent={(item) => (
									<SelectItem item={item.item}>
										{item.item.rawValue === "ccip"
											? "CCIP"
											: "EmbeddingGemma 2"}
									</SelectItem>
								)}
							>
								<SelectTrigger
									id="batch-vector-model"
									aria-label="Embedding model"
								>
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ccip"
												? "CCIP"
												: "EmbeddingGemma 2"
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
							<p class="text-xs text-muted-foreground">
								EmbeddingGemma 2 uses the shared AI Provider / Device settings.
								The first run downloads the Q8 model (768 dimensions).
							</p>
						</div>
					</Show>
					<div class="space-y-1.5">
						<Label>Target source</Label>
						<SourceSelect
							manager={props.manager}
							onChange={props.manager.setSelectedSourceId}
							value={props.manager.selectedSourceId()}
						/>
						<p class="text-xs text-muted-foreground">
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
						<p class="text-xs text-muted-foreground">
							When disabled, processed media is skipped.
						</p>
					</div>
				</div>
				<div class="mt-4 flex flex-col justify-end gap-2 border-border border-t pt-4 sm:flex-row">
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
