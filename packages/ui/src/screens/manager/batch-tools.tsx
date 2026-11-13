import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
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
	const pendingAction = () => props.manager.batchPendingAction();
	const isVector = () => props.kind === "vectors";
	const runStart = () =>
		isVector()
			? props.manager.handleStartBatchCcipExtraction()
			: props.manager.handleStartBatchTagging();

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-foreground">
					{isVector()
						? t("types.vectorExtraction")
						: t("jobTypes.bulk_tagging_parent")}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{isVector()
						? t(
								"batchTools.analyzeImagesAndRepresentativeVideoThumbnailsWithEmbeddingGemma2",
							)
						: t(
								"batchTools.analyzeImagesAndRepresentativeVideoThumbnailsAndSubmitAI",
							)}
				</p>
			</div>

			<section
				aria-labelledby={`${props.kind}-options-title`}
				class="border-border border-y bg-card py-4 sm:rounded-md sm:border sm:p-4"
			>
				<h3 class="sr-only" id={`${props.kind}-options-title`}>
					{t("batchTools.jobOptions")}
				</h3>
				<div class="grid gap-4 lg:grid-cols-2">
					<Show when={isVector()}>
						<div class="space-y-1.5">
							<Label for="batch-vector-model">{t("batchTools.model")}</Label>
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
											? t("batchTools.cCIP")
											: t("batchTools.embeddingGemma2")}
									</SelectItem>
								)}
							>
								<SelectTrigger
									id="batch-vector-model"
									aria-label={t("batchTools.embeddingModel")}
								>
									<SelectValue<string>>
										{(state) =>
											state.selectedOption() === "ccip"
												? t("batchTools.cCIP")
												: t("batchTools.embeddingGemma2")
										}
									</SelectValue>
								</SelectTrigger>
								<SelectContent />
							</Select>
							<p class="text-xs text-muted-foreground">
								{t(
									"batchTools.embeddingGemma2UsesTheSharedAIProviderDeviceSettings",
								)}
							</p>
						</div>
					</Show>
					<div class="space-y-1.5">
						<SourceSelect
							manager={props.manager}
							onChange={props.manager.setSelectedSourceId}
							value={props.manager.selectedSourceId()}
						/>
						<p class="text-xs text-muted-foreground">
							{t("batchTools.leaveEmptyToProcessAllSources")}
						</p>
					</div>
					<div class="space-y-2">
						<Label>{t("batchTools.existingResults")}</Label>
						<Checkbox
							checked={props.manager.forceRetag()}
							class="flex min-h-9 items-center gap-2"
							onChange={props.manager.setForceRetag}
						>
							<CheckboxControl />
							<CheckboxLabel>
								{isVector()
									? t("batchTools.forceReExtraction")
									: t("batchTools.forceReTagging")}
							</CheckboxLabel>
						</Checkbox>
						<p class="text-xs text-muted-foreground">
							{t("batchTools.whenDisabledProcessedMediaIsSkipped")}
						</p>
					</div>
				</div>
				<div class="mt-4 flex flex-col justify-end gap-2 border-border border-t pt-4 sm:flex-row">
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void props.manager.handleScan()}
						variant="outline"
					>
						{pendingAction() === "scan"
							? t("duplicates.scanning")
							: t("batchTools.scanTargets")}
					</Button>
					<Button
						class="w-full sm:w-auto"
						disabled={pendingAction() !== null || !!props.manager.activeJobId()}
						onClick={() => void runStart()}
					>
						{pendingAction() === "start"
							? t("thumbnail.submitting")
							: isVector()
								? t("batchTools.startExtraction")
								: t("batchTools.startTagging")}
					</Button>
				</div>
			</section>

			<ManagerJobStatus manager={props.manager} />
		</div>
	);
}
