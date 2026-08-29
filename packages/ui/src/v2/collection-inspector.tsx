import type { Media } from "@solid-imager/core/domain/media/schemas";
import ExternalLink from "lucide-solid/icons/external-link";
import X from "lucide-solid/icons/x";
import type { JSX } from "solid-js";
import { getOwner, runWithOwner, Show } from "solid-js";
import { Button } from "../button";

type V2CollectionInspectorProps = {
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
	return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("ja-JP", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function V2CollectionInspector(props: V2CollectionInspectorProps) {
	const owner = getOwner();
	const renderOwned = (render: () => JSX.Element) =>
		owner ? runWithOwner(owner, render) : render();

	return (
		<aside
			aria-label="選択中のメディア"
			class="sticky top-0 hidden max-h-[calc(100dvh-8rem)] min-h-0 min-w-0 overflow-hidden rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] 2xl:flex 2xl:flex-col"
		>
			<header class="z-10 flex h-12 shrink-0 items-center border-[var(--v2-border)] border-b bg-[var(--v2-surface)]/95 px-4 backdrop-blur-sm">
				<h2 class="min-w-0 flex-1 truncate font-semibold text-[var(--v2-text)] text-sm">
					選択中のメディア
				</h2>
				<Show when={props.onClose}>
					<Button
						aria-label="インスペクターを閉じる"
						class="size-8 shrink-0 p-0 text-[var(--v2-text-muted)]"
						onClick={() => props.onClose?.()}
						size="icon"
						variant="ghost"
					>
						<X aria-hidden="true" size={15} />
					</Button>
				</Show>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable]">
				<Show
					keyed
					fallback={
						<div class="space-y-4">
							<div class="flex aspect-[4/3] items-center justify-center rounded-md bg-[var(--v2-surface-muted)] px-6 text-center text-[var(--v2-text-muted)] text-sm">
								メディアを選択するとプレビューを表示します
							</div>
							<p class="text-center text-[var(--v2-text-muted)] text-xs leading-5">
								一覧からメディアを選択してください
							</p>
						</div>
					}
					when={props.media}
				>
					{(media) => (
						<div>
							<div class="aspect-[4/3] overflow-hidden rounded-md bg-[var(--v2-surface-muted)]">
								{renderOwned(() => props.renderPreview(media))}
							</div>
							<section class="border-[var(--v2-border)] border-b py-4">
								<h3
									class="break-words font-semibold text-[var(--v2-text)] text-sm"
									title={media.fileName}
								>
									{media.fileName}
								</h3>
								<p class="mt-2 whitespace-pre-wrap break-words text-[var(--v2-text-secondary)] text-xs leading-5">
									{media.description?.trim() || "説明はありません"}
								</p>
							</section>
							<dl class="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-[var(--v2-border)] border-b py-4 text-xs">
								<dt class="text-[var(--v2-text-muted)]">解像度</dt>
								<dd class="text-right text-[var(--v2-text)]">
									{media.width} × {media.height}
								</dd>
								<dt class="text-[var(--v2-text-muted)]">サイズ</dt>
								<dd class="text-right text-[var(--v2-text)]">
									{formatFileSize(media.fileSize)}
								</dd>
								<dt class="text-[var(--v2-text-muted)]">ソース</dt>
								<dd
									class="truncate text-right text-[var(--v2-text)]"
									title={props.sourceName}
								>
									{props.sourceName ?? "—"}
								</dd>
								<dt class="text-[var(--v2-text-muted)]">作成日</dt>
								<dd class="text-right text-[var(--v2-text)]">
									{formatDate(media.createdAt)}
								</dd>
								<dt class="text-[var(--v2-text-muted)]">更新日</dt>
								<dd class="text-right text-[var(--v2-text)]">
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
									詳細を開く
								</Button>
							</Show>
						</div>
					)}
				</Show>
			</div>
		</aside>
	);
}
