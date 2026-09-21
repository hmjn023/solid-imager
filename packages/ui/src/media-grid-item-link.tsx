import type { Media } from "@solid-imager/core/domain/media/schemas";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import type { MediaGridLinkProps } from "./media-grid-item";

export type MediaGridItemLinkProps = {
	children: MediaGridLinkProps["children"];
	linkProps: MediaGridLinkProps;
	media: Media;
	isBulkSelectMode?: boolean;
	isSelected?: boolean;
	onOpenMediaDetail?: () => void;
	onPrepareMediaDetail?: () => void;
	onPreviewSelect?: () => void;
	onSelectGesture?: (event: MouseEvent | KeyboardEvent) => void;
	onToggleSelect?: () => void;
};

const isPlainPrimaryClick = (event: MouseEvent) =>
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

				if (event.key === " " && props.onPreviewSelect) {
					event.preventDefault();
					props.onPreviewSelect();
				}
			}}
			params={{
				mediaId: props.media.id,
				mediaSourceId: props.media.mediaSourceId,
			}}
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
