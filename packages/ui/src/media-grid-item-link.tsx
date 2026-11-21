import type { Media } from "@solid-imager/core/media";
import { Link, type RouterHistory } from "@tanstack/solid-router";
import { createComputed, createEffect, Show } from "solid-js";
import type { MediaGridLinkProps } from "./media-grid-item";
import {
	createRelatedMediaReturnMarker,
	type MediaContextItem,
} from "./media-context";
import {
	isFineMediaPointer,
	isModifiedSelectionClick,
	isPlainPrimaryClick,
} from "./media-preview-selection";

export { isPlainPrimaryClick } from "./media-preview-selection";

export type MediaGridItemLinkProps = {
	children: MediaGridLinkProps["children"];
	linkProps: MediaGridLinkProps;
	media: Pick<Media, "id" | "mediaSourceId">;
	isBulkSelectMode?: boolean;
	isSelected?: boolean;
	relatedFrom?: MediaContextItem;
	onOpenMediaDetail?: () => void;
	onPrepareMediaDetail?: () => void;
	onPreviewSelect?: () => void;
	onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
	onToggleSelect?: () => void;
};

/** Shared link, preview, keyboard, and bulk-selection behavior for media tiles. */
export function MediaGridItemLink(props: MediaGridItemLinkProps) {
	let hostRef: HTMLDivElement | undefined;
	let pendingFocusRestore = false;

	createComputed((previous?: boolean) => {
		const current = Boolean(props.isBulkSelectMode);
		if (
			previous !== undefined &&
			previous !== current &&
			typeof document !== "undefined"
		) {
			const active = document.activeElement;
			if (
				active instanceof HTMLElement &&
				active.dataset.mediaId === props.media.id
			) {
				pendingFocusRestore = true;
			}
		}
		return current;
	});

	createEffect(() => {
		void props.isBulkSelectMode;
		if (!pendingFocusRestore) return;
		pendingFocusRestore = false;
		const nextControl = hostRef?.querySelector<HTMLElement>("[data-media-id]");
		nextControl?.focus({ preventScroll: true });
	});

	const detailLink = () => (
		<Link
			aria-current={props.linkProps["aria-current"]}
			class={props.linkProps.class}
			data-media-id={props.linkProps["data-media-id"]}
			onClick={(event: MouseEvent) => {
				if (
					props.onSelectGesture &&
					isFineMediaPointer(event) &&
					isModifiedSelectionClick(event)
				) {
					event.preventDefault();
					props.onSelectGesture(event);
					return;
				}
				if (!isPlainPrimaryClick(event)) return;

				if (props.onPreviewSelect && isFineMediaPointer(event)) {
					event.preventDefault();
					props.onPreviewSelect();
					return;
				}
				props.onPrepareMediaDetail?.();
			}}
			onContextMenu={props.linkProps.onContextMenu}
			onDblClick={(event: MouseEvent) => {
				if (
					!isPlainPrimaryClick(event) ||
					!isFineMediaPointer(event) ||
					!props.onOpenMediaDetail
				) {
					return;
				}

				event.preventDefault();
				props.onPrepareMediaDetail?.();
				props.onOpenMediaDetail();
			}}
			onKeyDown={(event: KeyboardEvent) => {
				if (
					event.key === "Enter" &&
					!event.metaKey &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey &&
					props.onOpenMediaDetail
				) {
					event.preventDefault();
					props.onPrepareMediaDetail?.();
					props.onOpenMediaDetail();
					return;
				}

				if (
					event.key === " " &&
					!event.altKey &&
					(props.onToggleSelect ||
						props.onPreviewSelect ||
						props.onSelectGesture)
				) {
					event.preventDefault();
					if (event.repeat) return;
					if (
						props.onSelectGesture &&
						(event.shiftKey || event.ctrlKey || event.metaKey)
					) {
						props.onSelectGesture(event);
					} else if (props.onToggleSelect) {
						props.onToggleSelect();
					} else {
						props.onPreviewSelect?.();
					}
				}
			}}
			params={{
				mediaId: props.media.id,
				mediaSourceId: props.media.mediaSourceId,
			}}
			state={
				props.relatedFrom
					? (state: RouterHistory["location"]["state"]) => ({
							...state,
							relatedMediaReturn: props.relatedFrom
								? createRelatedMediaReturnMarker(
										state,
										props.relatedFrom,
										props.media,
									)
								: undefined,
						})
					: undefined
			}
			to="/sources/$mediaSourceId/$mediaId"
		>
			{props.children}
		</Link>
	);

	return (
		<div
			class="contents"
			ref={(element) => {
				hostRef = element;
			}}
		>
			<Show fallback={detailLink()} when={props.isBulkSelectMode}>
				<button
					aria-pressed={props.isSelected}
					class={props.linkProps.class}
					data-media-id={props.linkProps["data-media-id"]}
					onClick={(event) => {
						event.preventDefault();
						if (props.onSelectGesture && isModifiedSelectionClick(event)) {
							props.onSelectGesture(event);
							return;
						}
						props.onToggleSelect?.();
					}}
					onContextMenu={props.linkProps.onContextMenu}
					type="button"
				>
					{props.children}
				</button>
			</Show>
		</div>
	);
}
