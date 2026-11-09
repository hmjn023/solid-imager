import type { Media } from "@solid-imager/core/media";
import { Link, type RouterHistory } from "@tanstack/solid-router";
import { Show } from "solid-js";
import type { MediaGridLinkProps } from "./media-grid-item";
import {
	createRelatedMediaReturnMarker,
	type MediaContextItem,
} from "./media-context";

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

export const isPlainPrimaryClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.metaKey &&
	!event.ctrlKey &&
	!event.shiftKey &&
	!event.altKey;

const isModifiedSelectionClick = (event: MouseEvent) =>
	event.button === 0 &&
	!event.altKey &&
	(event.metaKey || event.ctrlKey || event.shiftKey);

const hasFinePointer = () => window.matchMedia("(pointer: fine)").matches;

/** Shared link, preview, keyboard, and bulk-selection behavior for media tiles. */
export function MediaGridItemLink(props: MediaGridItemLinkProps) {
	const detailLink = () => (
		<Link
			aria-current={props.linkProps["aria-current"]}
			aria-pressed={props.linkProps["aria-pressed"]}
			class={props.linkProps.class}
			data-media-id={props.linkProps["data-media-id"]}
			onClick={(event: MouseEvent) => {
				if (
					props.onSelectGesture &&
					hasFinePointer() &&
					isModifiedSelectionClick(event)
				) {
					event.preventDefault();
					props.onSelectGesture(event);
					return;
				}
				if (!isPlainPrimaryClick(event)) return;

				if (props.onPreviewSelect && hasFinePointer()) {
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
					!hasFinePointer() ||
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
					!event.metaKey &&
					!event.ctrlKey &&
					!event.shiftKey &&
					!event.altKey &&
					(props.onToggleSelect || props.onPreviewSelect)
				) {
					event.preventDefault();
					if (event.repeat) return;
					if (props.onToggleSelect) props.onToggleSelect();
					else props.onPreviewSelect?.();
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
	);
}
