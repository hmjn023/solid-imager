import { getLocale, t } from "@solid-imager/i18n";
import type { Media } from "@solid-imager/core/media";
import ExternalLink from "lucide-solid/icons/external-link";
import X from "lucide-solid/icons/x";
import type { Accessor, JSX } from "solid-js";
import {
	createEffect,
	createMemo,
	createSignal,
	getOwner,
	onCleanup,
	onMount,
	runWithOwner,
	Show,
} from "solid-js";
import { Button } from "../button";
import type { QueryUiState } from "../query-state";
import { reconcileCollectionPreviewId } from "./collection-navigation";

export function createCollectionInspector(options: {
	media: Accessor<Media[]>;
	enabled: Accessor<boolean>;
	phase: Accessor<QueryUiState<Media[]>["phase"]>;
}) {
	const [isWide, setIsWide] = createSignal(false);
	const [isOpen, setIsOpen] = createSignal(true);
	const [previewId, setPreviewId] = createSignal<string | null>(null);
	const canPreview = () => isWide() && options.enabled();
	const isVisible = () =>
		canPreview() &&
		isOpen() &&
		(options.phase() === "pending" || options.phase() === "data");

	onMount(() => {
		// Use the workspace's 2xl threshold for both the layout and its pointer action.
		const viewport = window.matchMedia("(min-width: 96rem)");
		const update = () => setIsWide(viewport.matches);
		update();
		viewport.addEventListener("change", update);
		onCleanup(() => viewport.removeEventListener("change", update));
	});

	createEffect(() => {
		const nextId = options.enabled()
			? reconcileCollectionPreviewId(options.media(), previewId())
			: null;
		if (nextId !== previewId()) setPreviewId(nextId);
	});
	const selectMedia = (media: Media) => {
		setPreviewId(media.id);
		setIsOpen(true);
	};
	const previewSelection = createMemo(() =>
		canPreview() && isOpen() ? selectMedia : undefined,
	);

	return {
		isVisible,
		canToggle: canPreview,
		isOpen,
		open: () => setIsOpen(true),
		toggle: () => setIsOpen((open) => !open),
		previewId: () => (isVisible() ? previewId() : null),
		media: () => options.media().find((item) => item.id === previewId()),
		previewSelection,
		close: () => setIsOpen(false),
	};
}

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
			class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card"
		>
			<header class="z-10 flex h-12 shrink-0 items-center border-border border-b bg-card px-4">
				<h2 class="min-w-0 flex-1 truncate font-semibold text-foreground text-sm">
					{t("labels.selectedMedia")}
				</h2>
				<Show when={props.onClose}>
					<Button
						aria-label={t("collectionInspector.closeInspector")}
						class="size-11 shrink-0 p-0 text-muted-foreground sm:size-8"
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
							<dl class="grid grid-cols-label-field gap-x-3 gap-y-2.5 py-4 text-xs">
								<dt class="text-muted-foreground">
									{t("collectionInspector.resolution")}
								</dt>
								<dd class="text-right text-foreground">
									{media.width && media.height
										? `${media.width} × ${media.height}`
										: "—"}
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
						</div>
					)}
				</Show>
			</div>

			<Show when={props.media && props.onOpenDetail ? props.media : undefined}>
				{(media) => (
					<footer class="shrink-0 border-border border-t bg-card p-3">
						<Button
							class="min-h-11 w-full sm:min-h-9"
							onClick={() => props.onOpenDetail?.(media())}
							size="sm"
						>
							<ExternalLink aria-hidden="true" size={14} />
							{t("collectionInspector.openDetails")}
						</Button>
					</footer>
				)}
			</Show>
		</aside>
	);
}
