import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { Card } from "./card";
import { Checkbox, CheckboxControl, CheckboxLabel } from "./checkbox";
import { cn } from "./utils/cn";

export type MediaCardThumbnailProps = {
	alt: string;
	class: string;
	height?: number | null;
	loading: "eager" | "lazy";
	media: Media;
	sourceRootPath?: string;
	width?: number | null;
};

export type MediaCardLinkProps = {
	children: JSX.Element;
	class: string;
	href: string;
	onClick: (event: MouseEvent) => void;
};

type MediaCardItemProps = {
	media: Media;
	selectable?: boolean;
	isSelected?: boolean;
	onSelect?: (id: string) => void;
	priority?: boolean;
	sourceRootPath?: string;
	canRenderThumbnail?: (media: Media) => boolean;
	linkComponent?: (props: MediaCardLinkProps) => JSX.Element;
	renderThumbnail: (props: MediaCardThumbnailProps) => JSX.Element;
	class?: string;
	thumbnailContainerClass?: string;
	thumbnailClass?: string;
	checkboxContainerClass?: string;
	dimensionSeparator?: string;
};

function formatFileSize(bytes: number | null | undefined) {
	if (!bytes) {
		return "N/A";
	}
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatDimensions(media: Media, separator: string) {
	return media.width && media.height
		? `${media.width}${separator}${media.height}`
		: "N/A";
}

export function MediaCardItem(props: MediaCardItemProps) {
	const canRenderThumbnail = () =>
		props.canRenderThumbnail?.(props.media) ??
		props.media.mediaType === "image";
	const selected = () => props.isSelected ?? false;
	const href = () => `/sources/${props.media.mediaSourceId}/${props.media.id}`;

	const handleSelect = () => {
		if (props.selectable) {
			props.onSelect?.(props.media.id);
		}
	};

	return (
		<Card
			class={cn(
				"overflow-hidden transition-shadow hover:shadow-lg",
				selected() && "ring-2 ring-primary",
				props.class,
			)}
			onClick={handleSelect}
		>
			<div class="group relative">
				<div
					class={cn(
						"flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-100 text-gray-400 text-sm",
						props.thumbnailContainerClass,
					)}
				>
					<Show
						fallback={<div>{props.media.mediaType}</div>}
						when={canRenderThumbnail()}
					>
						{props.renderThumbnail({
							alt: props.media.fileName,
							class: cn(
								"h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
								props.thumbnailClass,
							),
							height: props.media.height,
							loading: props.priority ? "eager" : "lazy",
							media: props.media,
							sourceRootPath: props.sourceRootPath,
							width: props.media.width,
						})}
					</Show>
				</div>

				<Show when={props.selectable}>
					<div
						class={cn(
							"absolute top-2 right-2 z-10",
							props.checkboxContainerClass,
						)}
					>
						<Checkbox
							checked={selected()}
							onClick={(event) => event.stopPropagation()}
							onChange={() => props.onSelect?.(props.media.id)}
						>
							<CheckboxControl class="h-5 w-5 rounded border-gray-300 bg-white text-primary shadow-sm focus:ring-primary" />
							<CheckboxLabel class="sr-only">Select media</CheckboxLabel>
						</Checkbox>
					</div>
				</Show>
			</div>

			<div class="space-y-1 p-3">
				<h3 class="truncate font-semibold text-sm" title={props.media.fileName}>
					{props.media.fileName}
				</h3>
				<p
					class="truncate text-muted-foreground text-xs"
					title={props.media.filePath}
				>
					{props.media.filePath}
				</p>
				<div class="flex justify-between pt-1 text-muted-foreground text-xs">
					<span>
						{formatDimensions(props.media, props.dimensionSeparator ?? "\u00d7")}
					</span>
					<span>{formatFileSize(props.media.fileSize)}</span>
				</div>

				<Show when={!props.selectable && props.linkComponent}>
					{props.linkComponent?.({
						children: "Check Details",
						class:
							"mt-2 block text-center text-primary text-sm hover:underline",
						href: href(),
						onClick: (event) => event.stopPropagation(),
					})}
				</Show>
			</div>
		</Card>
	);
}
