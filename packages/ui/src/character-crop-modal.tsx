import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { DetectAndCropResponse } from "@solid-imager/core/domain/tagging/schemas";
import { createEffect, createSignal, For, Show, untrack } from "solid-js";
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

	createEffect(() => {
		if (props.isOpen) {
			detectAndCrop();
		} else {
			setResult(null);
			setError(null);
			setIsLoading(false);
		}
	});

	const detectAndCrop = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await props.fetchCrops(props.media.id, untrack(transparent));
			setResult(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleTransparentToggle = () => {
		setTransparent((prev) => !prev);
		if (result() !== null) {
			detectAndCrop();
		}
	};

	return (
		<Dialog
			onOpenChange={(open) => !open && props.onClose()}
			open={props.isOpen}
		>
			<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[900px]">
				<DialogHeader>
					<DialogTitle class="flex items-center gap-2">
						<span class="i-lucide-scan text-indigo-600" />
						Detect &amp; Crop Characters (Experimental)
					</DialogTitle>
					<DialogDescription>
						Detect persons in the image using dghs-imgutils-rs and preview the
						cropped regions. No data is saved to the server.
					</DialogDescription>
				</DialogHeader>

				<div class="flex items-center gap-2 py-2">
					<Checkbox checked={transparent()} onChange={handleTransparentToggle}>
						<CheckboxControl class="h-4 w-4 rounded border-gray-300 bg-white text-primary shadow-sm" />
						<CheckboxLabel class="cursor-pointer text-sm">
							Transparent background (ISNetIS segmentation, slower)
						</CheckboxLabel>
					</Checkbox>
				</div>

				<div class="py-2">
					<Show when={isLoading()}>
						<div class="flex flex-col items-center justify-center py-12">
							<div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
							<span class="mt-4 font-medium text-gray-600 text-sm">
								{transparent()
									? "Running person detection & segmentation..."
									: "Running person detection and cropping..."}
							</span>
						</div>
					</Show>

					<Show when={error()}>
						<div class="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
							<h4 class="font-semibold">Detection Error</h4>
							<p class="mt-1 text-sm">{error()}</p>
						</div>
					</Show>

					<Show when={result()}>
						<Show
							fallback={
								<div class="py-8 text-center text-gray-500">
									<span class="i-lucide-scan-face inline-block h-12 w-12" />
									<p class="mt-2">No persons detected in this image.</p>
								</div>
							}
							when={(result()?.detections.length ?? 0) > 0}
						>
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<For each={result()?.detections ?? []}>
									{(det) => (
										<div class="overflow-hidden rounded-lg border bg-gray-50">
											<div
												class="relative bg-gray-100"
												classList={{
													"bg-[url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2NkYPj/n4EBCxg5ODgYqIIxMTAwMDAwMDAzMDIwsDAwMDIwsDAwMDBQJ8AAAP//AwBpuQYZjU6F0AAAAABJRU5ErkJggg==)]":
														transparent(),
												}}
											>
												<img
													alt={`${det.label} ${det.index + 1}`}
													class="mx-auto block max-h-64 object-contain"
													src={`data:image/${det.format};base64,${det.imageBase64}`}
												/>
												<span class="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-white text-xs">
													#{det.index + 1}
												</span>
											</div>
											<div class="space-y-1 p-3 text-sm">
												<div class="flex items-center justify-between">
													<span class="font-medium capitalize text-gray-800">
														{det.label}
													</span>
													<span class="rounded bg-indigo-100 px-1.5 py-0.5 font-semibold text-indigo-700 text-xs">
														{(det.score * PERCENTAGE_MULTIPLIER).toFixed(1)}%
													</span>
												</div>
												<div class="text-gray-500 text-xs">
													{det.width} x {det.height}
												</div>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Show>
				</div>
			</DialogContent>
		</Dialog>
	);
}
