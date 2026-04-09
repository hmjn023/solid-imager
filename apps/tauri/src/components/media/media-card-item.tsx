import { Card } from "@solid-imager/ui/card";
import {
	Checkbox,
	CheckboxControl,
	CheckboxLabel,
} from "@solid-imager/ui/checkbox";
import { Show } from "solid-js";
import type { MockMedia } from "../../mocks/demo-data";

type MediaCardItemProps = {
	media: MockMedia;
	selectable?: boolean;
	selected?: boolean;
	onToggle?: (id: string) => void;
};

function formatSize(bytes: number) {
	return `${(bytes / 1024).toFixed(1)} KB`;
}

export function MediaCardItem(props: MediaCardItemProps) {
	return (
		<Card
			class={`overflow-hidden transition-shadow hover:shadow-lg ${
				props.selected ? "ring-2 ring-primary" : ""
			}`}
			onClick={() => props.selectable && props.onToggle?.(props.media.id)}
		>
			<div class="relative">
				<div class="flex aspect-video items-center justify-center bg-muted text-muted-foreground text-sm">
					{props.media.mediaType === "image"
						? props.media.fileName
						: props.media.mediaType}
				</div>
				<Show when={props.selectable}>
					<div class="absolute top-2 right-2 rounded bg-background/90 p-1">
						<Checkbox
							checked={props.selected}
							onChange={() => props.onToggle?.(props.media.id)}
						>
							<CheckboxControl />
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
				<div class="flex justify-between text-muted-foreground text-xs">
					<span>
						{props.media.width}x{props.media.height}
					</span>
					<span>{formatSize(props.media.fileSize)}</span>
				</div>
			</div>
		</Card>
	);
}
