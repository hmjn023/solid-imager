import { getLocale, t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import ExternalLink from "lucide-solid/icons/external-link";
import X from "lucide-solid/icons/x";
import type { JSX } from "solid-js";
import { getOwner, runWithOwner, Show } from "solid-js";
import { Button } from "../button";

type CollectionInspectorProps = {
	media: Media | undefined;
	sourceName?: string;
	onClose?: () => void;
	onOpenDetail?: (media: Media) => void;
	renderPreview: (media: Media) => JSX.Element;
};

function formatFileSize(bytes: number | null): string {
	if (bytes === null) return "—";
	const units = ["B", "KB", "MB", "GB"];
	let value = bytes;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}
	return t("characterCropModal.valueValue", {
		value0: String(
			value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1),
		),
		value1: String(units[unitIndex]),
	});
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat(getLocale(), {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function CollectionInspector(props: CollectionInspectorProps) {
	const owner = getOwner();
	const renderOwned = (render: () => JSX.Element) =>
		owner ? runWithOwner(owner, render) : render();

	return (
		<aside
			aria-label={t("labels.selectedMedia")}
			class="sticky top-0 hidden max-h-dialog-screen-compact min-h-0 min-w-0 overflow-hidden rounded-md border border-border bg-card 2xl:flex 2xl:flex-col"
		>
			<header class="z-10 flex h-12 shrink-0 items-center border-border border-b bg-card/95 px-4 backdrop-blur-sm">
				<h2 class="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">
					{t("labels.selectedMedia")}
				</h2>
				<Show when={props.onClose}>
					<Button
						aria-label={t("collectionInspector.closeInspector")}
						class="size-8 shrink-0 p-0 text-muted-foreground"
						onClick={() => props.onClose?.()}
						size="icon"
						variant="ghost"
					>
						<X aria-hidden="true" size={15} />
					</Button>
				</Show>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-stable">
				<Show
					keyed
					fallback={
						<div class="space-y-4">
							<div class="flex aspect-landscape items-center justify-center rounded-md bg-muted px-6 text-center text-muted-foreground text-sm">
								{t("collectionInspector.selectMediaToShowAPreview")}
							</div>
							<p class="text-center text-muted-foreground text-xs leading-5">
								{t("collectionInspector.selectMediaFromTheList")}
							</p>
						</div>
					}
					when={props.media}
				>
					{(media) => (
						<div>
							<div class="aspect-landscape overflow-hidden rounded-md bg-muted">
								{renderOwned(() => props.renderPreview(media))}
							</div>
							<section class="border-border border-b py-4">
								<h3
									class="break-words font-semibold text-foreground text-sm"
									title={media.fileName}
								>
									{media.fileName}
								</h3>
								<p class="mt-2 whitespace-pre-wrap break-words text-muted-foreground text-xs leading-5">
									{media.description?.trim() || t("labels.noDescription")}
								</p>
							</section>
							<dl class="grid grid-cols-label-field gap-x-3 gap-y-2.5 border-border border-b py-4 text-xs">
								<dt class="text-muted-foreground">
									{t("collectionInspector.resolution")}
								</dt>
								<dd class="text-right text-foreground">
									{media.width} × {media.height}
								</dd>
								<dt class="text-muted-foreground">
									{t("collectionInspector.size")}
								</dt>
								<dd class="text-right text-foreground">
									{formatFileSize(media.fileSize)}
								</dd>
								<dt class="text-muted-foreground">{t("labels.source")}</dt>
								<dd
									class="truncate text-right text-foreground"
									title={props.sourceName}
								>
									{props.sourceName ?? "—"}
								</dd>
								<dt class="text-muted-foreground">
									{t("collectionInspector.created")}
								</dt>
								<dd class="text-right text-foreground">
									{formatDate(media.createdAt)}
								</dd>
								<dt class="text-muted-foreground">
									{t("collectionInspector.updated")}
								</dt>
								<dd class="text-right text-foreground">
									{formatDate(media.modifiedAt)}
								</dd>
							</dl>
							<Show when={props.onOpenDetail}>
								<Button
									class="mt-4 min-h-11 w-full sm:min-h-9"
									onClick={() => props.onOpenDetail?.(media)}
									size="sm"
								>
									<ExternalLink aria-hidden="true" size={14} />
									{t("collectionInspector.openDetails")}
								</Button>
							</Show>
						</div>
					)}
				</Show>
			</div>
		</aside>
	);
}
