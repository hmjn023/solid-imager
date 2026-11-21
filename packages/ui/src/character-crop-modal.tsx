import { t } from "@solid-imager/i18n";
import type { MediaDetails } from "@solid-imager/core/media";
import type { DetectAndCropResponse } from "@solid-imager/core/tagging";
import Download from "lucide-solid/icons/download";
import Scan from "lucide-solid/icons/scan";
import ScanFace from "lucide-solid/icons/scan-face";
import {
	createEffect,
	createSignal,
	For,
	onCleanup,
	Show,
	untrack,
} from "solid-js";
import { buttonVariants } from "./button";
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";

export type CharacterCropModalProps = {
	isOpen: boolean;
	onClose: () => void;
	media: MediaDetails;
	fetchCrops: (
		mediaId: string,
		transparent: boolean,
	) => Promise<DetectAndCropResponse>;
};

const PERCENTAGE_MULTIPLIER = 100;

export function CharacterCropModal(props: CharacterCropModalProps) {
	const [isLoading, setIsLoading] = createSignal(false);
	const [result, setResult] = createSignal<DetectAndCropResponse | null>(null);
	const [error, setError] = createSignal<string | null>(null);
	const [transparent, setTransparent] = createSignal(false);
	let requestId = 0;

	onCleanup(() => {
		requestId += 1;
	});

	const detectAndCrop = async (useTransparent: boolean) => {
		const currentRequestId = ++requestId;
		setIsLoading(true);
		setError(null);
		setResult(null);
		try {
			const data = await props.fetchCrops(props.media.id, useTransparent);
			if (currentRequestId !== requestId) return;
			setResult(data);
		} catch (err) {
			if (currentRequestId !== requestId) return;
			setError(
				err instanceof Error
					? err.message
					: t("characterCropModal.unknownErrorOccurred"),
			);
		} finally {
			if (currentRequestId === requestId) {
				setIsLoading(false);
			}
		}
	};

	createEffect(() => {
		if (props.isOpen) {
			void detectAndCrop(untrack(transparent));
		} else {
			requestId += 1;
			setResult(null);
			setError(null);
			setIsLoading(false);
		}
	});

	const handleTransparentToggle = (checked: boolean) => {
		setTransparent(checked);
		if (props.isOpen) {
			void detectAndCrop(checked);
		}
	};

	const baseFileName = () => {
		const name = props.media.fileName.replace(/\.[^.]+$/, "");
		return name || props.media.id;
	};

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open && !isLoading()) props.onClose();
			}}
			open={props.isOpen}
		>
			<DialogContent class="sm:max-w-dialog-xl" closeDisabled={isLoading()}>
				<DialogHeader>
					<DialogTitle class="flex items-center gap-2">
						<Scan aria-hidden="true" class="size-4 text-info-foreground" />
						{t("characterCropModal.detectCropCharactersExperimental")}
					</DialogTitle>
					<DialogDescription>
						{t("characterCropModal.detectPersonsInTheImageUsingDghsImgutilsRs")}
					</DialogDescription>
				</DialogHeader>

				<div class="flex items-center gap-2 py-2">
					<Checkbox
						checked={transparent()}
						class="flex min-h-11 items-center gap-2 sm:min-h-9"
						onChange={handleTransparentToggle}
					>
						<CheckboxControl />
						<CheckboxLabel class="cursor-pointer text-sm">
							{t(
								"characterCropModal.transparentBackgroundISNetISSegmentationSlower",
							)}
						</CheckboxLabel>
					</Checkbox>
				</div>

				<div class="py-2">
					<Show when={isLoading()}>
						<div class="flex flex-col items-center justify-center py-12">
							<div class="h-10 w-10 motion-safe:animate-spin rounded-full border-4 border-info-foreground border-t-transparent" />
							<span class="mt-4 font-medium text-muted-foreground text-sm">
								{transparent()
									? t("characterCropModal.runningPersonDetectionSegmentation")
									: t("characterCropModal.runningPersonDetectionAndCropping")}
							</span>
						</div>
					</Show>

					<Show when={error()}>
						<div
							class="rounded-md border border-error bg-error p-4 text-destructive"
							role="alert"
						>
							<h4 class="font-semibold">
								{t("characterCropModal.detectionError")}
							</h4>
							<p class="mt-1 text-sm">{error()}</p>
						</div>
					</Show>

					<Show when={result()}>
						<Show
							fallback={
								<div class="py-8 text-center text-muted-foreground">
									<ScanFace aria-hidden="true" class="inline-block size-12" />
									<p class="mt-2">
										{t("characterCropModal.noPersonsDetectedInThisImage")}
									</p>
								</div>
							}
							when={(result()?.detections.length ?? 0) > 0}
						>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<For each={result()?.detections ?? []}>
									{(det) => {
										const dataUrl = () =>
											`data:image/${det.format};base64,${det.imageBase64}`;
										const downloadName = () =>
											`${baseFileName()}-crop-${det.index + 1}.${det.format}`;
										return (
											<div class="overflow-hidden rounded-lg border bg-background">
												<div
													class="relative bg-muted"
													classList={{
														"bg-checkerboard": transparent(),
													}}
												>
													<img
														alt={t("characterCropModal.valueValue", {
															value0: String(det.label),
															value1: String(det.index + 1),
														})}
														class="mx-auto block max-h-64 object-contain"
														src={dataUrl()}
													/>
													<span class="absolute top-1 left-1 rounded bg-popover/90 px-1.5 py-0.5 font-mono text-popover-foreground text-xs">
														#{det.index + 1}
													</span>
												</div>
												<div class="space-y-2 p-3 text-sm">
													<div class="flex items-center justify-between gap-2">
														<span class="font-medium capitalize text-foreground">
															{det.label}
														</span>
														<span class="rounded bg-info px-1.5 py-0.5 font-semibold text-info-foreground text-xs">
															{(det.score * PERCENTAGE_MULTIPLIER).toFixed(1)}%
														</span>
													</div>
													<div class="flex items-center justify-between gap-2">
														<span class="text-muted-foreground text-xs">
															{t("characterCropModal.valueXValue", {
																value0: String(det.width),
																value1: String(det.height),
															})}
														</span>
														<a
															class={buttonVariants({
																class: "min-h-11 gap-1.5 sm:min-h-8",
																size: "sm",
																variant: "outline",
															})}
															download={downloadName()}
															href={dataUrl()}
														>
															<Download aria-hidden="true" size={14} />
															{t("characterCropModal.downloadCrop")}
														</a>
													</div>
												</div>
											</div>
										);
									}}
								</For>
							</div>
						</Show>
					</Show>
				</div>
			</DialogContent>
		</Dialog>
	);
}
