import type { MediaSearchResponse } from "@solid-imager/core/domain/media/schemas";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@solid-imager/ui/context-menu";
import type { Accessor, Setter } from "solid-js";
import { For, Show } from "solid-js";
import { ThumbnailImage } from "~/components/media/thumbnail-image";

type MediaGridProps = {
	contextMenuMediaId: Accessor<string | null>;
	isError: boolean;
	isFetchingNextPage: boolean;
	isPending: boolean;
	loadMoreRef: (element: HTMLDivElement) => void;
	mediaPages: Accessor<MediaSearchResponse[] | undefined>;
	mediaSourceId: Accessor<string | undefined>;
	onCopyMove: (mediaId: string, mode: "copy" | "move") => void;
	onDelete: (mediaId: string) => void;
	onSyncSingleMedia: (mediaId: string) => void;
	queryError: Error | null;
	setContextMenuMediaId: Setter<string | null>;
};

export function MediaGrid(props: MediaGridProps) {
	return (
		<div class="flex flex-col gap-4">
			<Show when={props.isPending && !props.mediaPages()}>
				<div class="flex h-64 items-center justify-center">
					<div class="animate-pulse text-lg text-muted-foreground">
						Loading media...
					</div>
				</div>
			</Show>

			<Show when={props.isError}>
				<div class="text-red-500">Error: {props.queryError?.message}</div>
			</Show>

			<ContextMenu>
				<ContextMenuTrigger class="h-full w-full">
					<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
						<For each={props.mediaPages()}>
							{(page) => (
								<For each={page.media.flatMap((item) => (item ? [item] : []))}>
									{(item) => (
										<a
											class="relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md"
											data-media-id={item.id}
											href={`/sources/${props.mediaSourceId() ?? ""}/${item.id}`}
											onContextMenu={() => props.setContextMenuMediaId(item.id)}
										>
											<Show
												fallback={
													<div class="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400">
														{item.mediaType}
													</div>
												}
												when={item.mediaType !== "audio"}
											>
												<ThumbnailImage
													alt={item.fileName}
													class="h-full w-full object-cover"
													height={item.height}
													loading="lazy"
													mediaId={item.id}
													mediaSourceId={props.mediaSourceId() ?? ""}
													modifiedAt={item.modifiedAt}
													width={item.width}
												/>
											</Show>
										</a>
									)}
								</For>
							)}
						</For>
					</div>
				</ContextMenuTrigger>
				<ContextMenuContent>
					<Show
						fallback={
							<ContextMenuItem disabled>No media selected</ContextMenuItem>
						}
						when={props.contextMenuMediaId()}
					>
						<ContextMenuItem
							onSelect={() => {
								const id = props.contextMenuMediaId();
								if (id) {
									window.open(
										`/sources/${props.mediaSourceId()}/${id}`,
										"_blank",
									);
								}
							}}
						>
							Open in New Tab
						</ContextMenuItem>
						<ContextMenuItem
							class="text-red-600 focus:text-red-600"
							onSelect={() => {
								const id = props.contextMenuMediaId();
								if (id) {
									props.onDelete(id);
								}
							}}
						>
							Delete
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							onSelect={() => {
								const id = props.contextMenuMediaId();
								if (id) {
									props.onCopyMove(id, "copy");
								}
							}}
						>
							Copy to Source
						</ContextMenuItem>
						<ContextMenuItem
							onSelect={() => {
								const id = props.contextMenuMediaId();
								if (id) {
									props.onCopyMove(id, "move");
								}
							}}
						>
							Move to Source
						</ContextMenuItem>
						<ContextMenuSeparator />
						<ContextMenuItem
							onSelect={() => {
								const id = props.contextMenuMediaId();
								if (id) {
									props.onSyncSingleMedia(id);
								}
							}}
						>
							Sync Metadata (Reprocess)
						</ContextMenuItem>
					</Show>
				</ContextMenuContent>
			</ContextMenu>

			<div class="h-10 w-full" ref={props.loadMoreRef}>
				<Show when={props.isFetchingNextPage}>
					<div class="text-center text-gray-500">Loading more...</div>
				</Show>
			</div>
		</div>
	);
}
