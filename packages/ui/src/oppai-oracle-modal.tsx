import { t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import type { OppaiOracleResponse } from "@solid-imager/core/tagging";
import Check from "@lucide/solid/icons/check";
import Copy from "@lucide/solid/icons/copy";
import { createSignal, For, Show } from "solid-js";
import { Badge } from "./badge";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { toast } from "./toast";

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
	const [copied, setCopied] = createSignal(false);

	createTrackedEffect(() => {
		if (props.isOpen) {
			let isCancelled = false;
			setCopied(false);

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
						const message = err instanceof Error ? err.message : err;
						setError(
							typeof message === "string" && message.trim()
								? message
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

			return () => {
				isCancelled = true;
			};
		} else {
			setResult(null);
			setError(null);
			setIsLoading(false);
			setCopied(false);
		}
	});

	const handleCopyTags = async (tags: readonly [string, number][]) => {
		const text = tags.map(([name]) => name).join(", ");
		if (!text) return;
		if (!navigator.clipboard) {
			toast.error(t("clipboardCopy.clipboardAPINotSupportedOrNotInASecure"));
			return;
		}
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toast.success(t("clipboardCopy.copiedToClipboard"));
		} catch {
			toast.error(t("clipboardCopy.failedToCopy"));
		}
	};

	return (
		<Dialog
			onOpenChange={(open: boolean) => {
				if (!open && !isLoading()) props.onClose();
			}}
			open={props.isOpen}
		>
			<DialogContent class="sm:max-w-dialog-lg" closeDisabled={isLoading()}>
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

				<div class="space-y-4 py-4">
					<p class="rounded-md border border-border bg-muted px-3 py-2 text-muted-foreground text-xs">
						{t("oppaiOracleModal.previewOnlyNotice")}
					</p>

					<Show when={isLoading()}>
						<div class="flex items-center justify-center py-8">
							<div class="h-8 w-8 motion-safe:animate-spin rounded-full border-4 border-warning-foreground border-t-transparent" />
							<span class="ml-2 text-muted-foreground">
								{props.mediaType === "video"
									? t("oppaiOracleModal.analyzingVideoThumbnail")
									: t("oppaiOracleModal.analyzingImage")}
							</span>
						</div>
					</Show>

					<Show when={error()}>
						<div class="rounded-md bg-error p-4 text-destructive" role="alert">
							<h4 class="font-semibold">
								{t("oppaiOracleModal.failedToAnalyzeImage")}
							</h4>
							<p class="mt-1 text-sm">{error()}</p>
						</div>
					</Show>

					<Show when={result()}>
						{(res) => {
							const ratings = () =>
								Object.entries(res().rating).sort(([, a], [, b]) => b - a);
							const allGeneralTags = () =>
								Object.entries(res().general).sort(([, a], [, b]) => b - a);
							const visibleGeneralTags = () =>
								allGeneralTags().slice(0, MAX_GENERAL_TAGS_DISPLAY);
							const hasAnyResult = () =>
								ratings().length > 0 || allGeneralTags().length > 0;
							return (
								<Show
									fallback={
										<p class="text-muted-foreground text-sm">
											{t("oppaiOracleModal.noTagsDetected")}
										</p>
									}
									when={hasAnyResult()}
								>
									<div class="space-y-6">
										<Show when={ratings().length > 0}>
											<div>
												<h3 class="mb-2 font-semibold text-lg">
													{t("sortOptions.rating")}
												</h3>
												<div class="flex flex-wrap gap-2">
													<For each={ratings()}>
														{([name, score]) => (
															<Badge class="flex gap-1" variant="outline">
																<span>{name}</span>
																<span class="text-xs opacity-70">
																	({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}
																	%)
																</span>
															</Badge>
														)}
													</For>
												</div>
											</div>
										</Show>

										<Show when={allGeneralTags().length > 0}>
											<div>
												<div class="mb-2 flex flex-wrap items-center justify-between gap-2">
													<h3 class="font-semibold text-lg">
														{t("oppaiOracleModal.generalTags")}
													</h3>
													<Button
														class="min-h-11 gap-1.5 sm:min-h-9"
														onClick={() =>
															void handleCopyTags(allGeneralTags())
														}
														size="sm"
														type="button"
														variant="outline"
													>
														<Show
															fallback={<Copy aria-hidden="true" size={14} />}
															when={copied()}
														>
															<Check aria-hidden="true" size={14} />
														</Show>
														{t("oppaiOracleModal.copyTags")}
													</Button>
												</div>
												<div class="flex flex-wrap gap-2">
													<For each={visibleGeneralTags()}>
														{([name, score]) => (
															<Badge
																class="flex gap-1 bg-muted text-foreground hover:bg-muted"
																variant="default"
															>
																<span>{name}</span>
																<span class="text-xs opacity-70">
																	({(score * PERCENTAGE_MULTIPLIER).toFixed(1)}
																	%)
																</span>
															</Badge>
														)}
													</For>
												</div>
												<Show
													when={
														allGeneralTags().length > MAX_GENERAL_TAGS_DISPLAY
													}
												>
													<p class="mt-2 text-muted-foreground text-sm">
														{t(
															"oppaiOracleModal.showingTopValueOfValueValueTags",
															{
																value0: String(MAX_GENERAL_TAGS_DISPLAY),
																value2: String(allGeneralTags().length),
															},
														)}
													</p>
												</Show>
											</div>
										</Show>
									</div>
								</Show>
							);
						}}
					</Show>
				</div>
			</DialogContent>
		</Dialog>
	);
}

import { createTrackedEffect } from "solid-js";
