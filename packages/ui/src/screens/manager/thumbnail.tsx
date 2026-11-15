import { t } from "@solid-imager/i18n";
import { Button } from "../../button";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { ManagerJobStatus } from "./job-status";
import { SourceSelect } from "./source-select";

export function ThumbnailWarmupPanel(props: { manager: UseManagerPageResult }) {
	const isStarting = () => props.manager.batchPendingAction() === "start";

	return (
		<div class="space-y-5">
			<div>
				<h2 class="font-semibold text-lg text-foreground">
					{t("thumbnail.thumbnailWarmup")}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{t(
						"thumbnail.generateMissing256pxGridThumbnailsWithoutReplacingExisting512px",
					)}
				</p>
			</div>

			<section class="border-border border-y bg-card py-4 sm:rounded-md sm:border sm:p-4">
				<div class="space-y-1.5">
					<SourceSelect
						manager={props.manager}
						onChange={props.manager.setSelectedSourceId}
						placeholder={t("actions.selectSource")}
						value={props.manager.selectedSourceId()}
					/>
					<p class="text-xs text-muted-foreground">
						{t("thumbnail.onlyMissing256pxVariantsAreQueuedSelectOneSource")}
					</p>
				</div>
				<div class="mt-4 flex justify-end border-border border-t pt-4">
					<Button
						class="w-full sm:w-auto"
						disabled={
							isStarting() ||
							!!props.manager.activeJobId() ||
							!props.manager.selectedSourceId()
						}
						onClick={() => void props.manager.handleStartThumbnailWarmup()}
					>
						{isStarting()
							? t("thumbnail.submitting")
							: t("thumbnail.warmMissingThumbnails")}
					</Button>
				</div>
			</section>

			<ManagerJobStatus manager={props.manager} />
		</div>
	);
}
