import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import type { OppaiOracleResponse } from "@solid-imager/core/tagging";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { Badge } from "./badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";

export type OppaiOracleModalProps = {
	isOpen: boolean;
	onClose: () => void;
	fetchTags: () => Promise<OppaiOracleResponse>;
	description?: string;
	mediaType?: Media["mediaType"];
	onSuccess?: () => void;
};

const PERCENTAGE_MULTIPLIER = 100;
const DEFAULT_DESCRIPTION = t(
	"oppaiOracleModal.tagsExtractedFromTheImageUsingTheOppaiOracleModel",
);
const MAX_GENERAL_TAGS_DISPLAY = 50;

export function OppaiOracleModal(props: OppaiOracleModalProps) {
	const [isLoading, setIsLoading] = createSignal(false);
	const [result, setResult] = createSignal<OppaiOracleResponse | null>(null);
	const [error, setError] = createSignal<string | null>(null);

	createEffect(() => {
		if (props.isOpen) {
			let isCancelled = false;

			const fetchTags = async () => {
				setIsLoading(true);
				setResult(null);
				setError(null);
				try {
					const data = await props.fetchTags();
					if (!isCancelled) {
						setResult(data);
						props.onSuccess?.();
					}
				} catch (err) {
					if (!isCancelled) {
						setError(
							err instanceof Error
								? err.message
								: t("characterCropModal.unknownErrorOccurred"),
						);
					}
				} finally {
					if (!isCancelled) {
						setIsLoading(false);
					}
				}
			};

			void fetchTags();

			onCleanup(() => {
				isCancelled = true;
			});
		} else {
			setResult(null);
			setError(null);
			setIsLoading(false);
		}
	});

	return (
		<Dialog
			onOpenChange={(open: boolean) => !open && props.onClose()}
			open={props.isOpen}
		>
			<DialogContent class="sm:max-w-dialog-lg">
				<DialogHeader>
					<DialogTitle>
						{t("oppaiOracleModal.oppaiOracleTaggingResults")}
					</DialogTitle>
					<DialogDescription>
						{props.description ??
							(props.mediaType === "video"
								? t(
										"oppaiOracleModal.tagsExtractedFromTheVideoSRepresentativeThumbnailUsing",
									)
								: DEFAULT_DESCRIPTION)}
					</DialogDescription>
				</DialogHeader>

				<div class="py-4">
					<Show when={isLoading()}>
						<div class="flex items-center justify-center py-8">
							<div class="h-8 w-8 animate-spin rounded-full border-4 border-warning-foreground border-t-transparent" />
							<span class="ml-2 text-muted-foreground">
								{props.mediaType === "video"
									? t("oppaiOracleModal.analyzingVideoThumbnail")
									: t("oppaiOracleModal.analyzingImage")}
							</span>
						</div>
					</Show>

					<Show when={error()}>
						<div class="rounded-md bg-error p-4 text-destructive">
							{t("useManagerPage.errorValue", { value0: String(error()) })}
						</div>
					</Show>

					<Show when={result()}>
						{(res) => (
							<div class="space-y-6">
								<Show when={Object.keys(res().rating).length > 0}>
									<div>
										<h3 class="mb-2 font-semibold text-lg">
											{t("sortOptions.rating")}
										</h3>
										<div class="flex flex-wrap gap-2">
											<For each={Object.entries(res().rating)}>
												{([name, score]) => (
													<Badge class="flex gap-1" variant="outline">
														<span>{name}</span>
														<span class="text-xs opacity-70">
															({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}%)
														</span>
													</Badge>
												)}
											</For>
										</div>
									</div>
								</Show>

								<div>
									<h3 class="mb-2 font-semibold text-lg">
										{t("oppaiOracleModal.generalTags")}
									</h3>
									<div class="flex flex-wrap gap-2">
										<For
											each={Object.entries(res().general)
												.sort(([, a], [, b]) => b - a)
												.slice(0, MAX_GENERAL_TAGS_DISPLAY)}
										>
											{([name, score]) => (
												<Badge
													class="flex gap-1 bg-muted text-foreground hover:bg-muted"
													variant="default"
												>
													<span>{name}</span>
													<span class="text-xs opacity-70">
														({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}%)
													</span>
												</Badge>
											)}
										</For>
									</div>
									<Show
										when={
											Object.keys(res().general).length >
											MAX_GENERAL_TAGS_DISPLAY
										}
									>
										<p class="mt-2 text-muted-foreground text-sm">
											{t("oppaiOracleModal.showingTopValueOfValueValueTags", {
												value0: String(MAX_GENERAL_TAGS_DISPLAY),
												value2: String(Object.keys(res().general).length),
											})}
										</p>
									</Show>
								</div>
							</div>
						)}
					</Show>
				</div>
			</DialogContent>
		</Dialog>
	);
}
