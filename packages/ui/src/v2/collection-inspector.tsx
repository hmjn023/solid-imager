import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { JSX } from "solid-js";
import { getOwner, runWithOwner, Show } from "solid-js";
import { Button } from "../button";

type V2CollectionInspectorProps = {
	media: Media | undefined;
	sourceName?: string;
	onOpenDetail?: (media: Media) => void;
	renderPreview: (media: Media) => JSX.Element;
};

function formatFileSize(bytes: number | null) {
	if (bytes === null) return null;
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
			class="sticky top-0 hidden h-fit min-w-0 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface)] p-3 2xl:block"
		>
			<Show
				keyed
				fallback={
					<div class="flex aspect-[4/3] items-center justify-center rounded-md bg-[var(--v2-surface-muted)] px-6 text-center text-[var(--v2-text-muted)] text-sm">
						メディアを選択すると、ここにプレビューと概要が表示されます
					</div>
				}
				when={props.media}
			>
				{(media) => (
					<div class="space-y-3">
						<div class="aspect-[4/3] overflow-hidden rounded-md bg-[var(--v2-surface-muted)]">
							{renderOwned(() => props.renderPreview(media))}
						</div>
						<div class="min-w-0">
							<p
								class="break-words font-semibold text-[var(--v2-text)] text-sm"
								title={media.fileName}
							>
								{media.fileName}
							</p>
							<dl class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
								<dt class="text-[var(--v2-text-muted)]">解像度</dt>
								<dd class="text-right text-[var(--v2-text)]">
									{media.width} × {media.height}
								</dd>
								<Show when={formatFileSize(media.fileSize)}>
									{(size) => (
										<>
											<dt class="text-[var(--v2-text-muted)]">サイズ</dt>
											<dd class="text-right text-[var(--v2-text)]">{size()}</dd>
										</>
									)}
								</Show>
								<dt class="text-[var(--v2-text-muted)]">作成日</dt>
								<dd class="text-right text-[var(--v2-text)]">
									{formatDate(media.createdAt)}
								</dd>
								<Show when={props.sourceName}>
									{(sourceName) => (
										<>
											<dt class="text-[var(--v2-text-muted)]">ソース</dt>
											<dd
												class="truncate text-right text-[var(--v2-text)]"
												title={sourceName()}
											>
												{sourceName()}
											</dd>
										</>
									)}
								</Show>
							</dl>
						</div>
						<Show when={props.onOpenDetail}>
							<Button
								class="min-h-11 w-full sm:min-h-9"
								onClick={() => props.onOpenDetail?.(media)}
								size="sm"
							>
								詳細を開く
							</Button>
						</Show>
					</div>
				)}
			</Show>
		</aside>
	);
}
