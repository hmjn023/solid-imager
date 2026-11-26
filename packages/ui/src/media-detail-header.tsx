import type { MediaDetails } from "@solid-imager/core/media";
import { useNavigate, useRouter } from "@tanstack/solid-router";
import type { RouterHistory } from "@tanstack/solid-router";
import { onCleanup, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { MediaDetailToolbar } from "./media-detail-layout";
import {
	clearMediaReturnPath,
	createRelatedMediaReturnMarker,
	findMediaNeighbors,
	getMediaReturnHistoryDelta,
	readMediaContext,
	readMediaReturnPath,
} from "./media-context";

export type MediaDetailHeaderProps = {
	media: MediaDetails;
	sourceName: string;
	onUpdate: () => void;
	renderActions?: (media: MediaDetails, onUpdate: () => void) => JSX.Element;
};

function isCollectionRoute(path: string): boolean {
	try {
		const url = new URL(path, "http://solid-imager.invalid");
		return url.pathname === "/search" || url.pathname.startsWith("/sources/");
	} catch {
		return false;
	}
}

/** The current detail header shared by Web and Tauri route adapters. */
export function MediaDetailHeader(props: MediaDetailHeaderProps) {
	const navigate = useNavigate();
	const router = useRouter();
	// This shared UI package is compiled without either app's router registration.
	const history = router.history as RouterHistory;
	const neighbors = () => findMediaNeighbors(props.media.id);
	let unsubscribeReturnCleanup: (() => void) | undefined;
	onCleanup(() => {
		unsubscribeReturnCleanup?.();
		unsubscribeReturnCleanup = undefined;
	});

	/** Replaces the detail entry while carrying a verified collection-return marker. */
	const navigateToNeighbor = (direction: "next" | "previous") => {
		const neighbor = neighbors()[direction];
		if (!neighbor) return;
		void navigate({
			params: {
				mediaId: neighbor.id,
				mediaSourceId: neighbor.mediaSourceId,
			},
			replace: true,
			state: (state: RouterHistory["location"]["state"]) => ({
				...state,
				relatedMediaReturn: createRelatedMediaReturnMarker(
					state,
					props.media,
					neighbor,
					true,
				),
			}),
			to: "/sources/$mediaSourceId/$mediaId",
		});
	};

	/**
	 * Restores a verified collection history entry, or uses its saved route when the
	 * current detail has no valid history chain. Direct links fall back to their source.
	 */
	const returnToCollection = () => {
		const returnPath = readMediaReturnPath();
		if (returnPath && isCollectionRoute(returnPath)) {
			const context = readMediaContext();
			const historyDelta = getMediaReturnHistoryDelta(
				context,
				returnPath,
				history.location.state,
				props.media,
			);
			const originPathname = history.location.pathname;
			unsubscribeReturnCleanup?.();
			unsubscribeReturnCleanup = router.subscribe("onResolved", () => {
				if (history.location.pathname !== originPathname) {
					unsubscribeReturnCleanup?.();
					unsubscribeReturnCleanup = undefined;
					clearMediaReturnPath();
				}
			});
			// Reuse the collection history entry so its search and scroll state
			// survive. Direct links have no preceding collection and use the fallback.
			if (historyDelta !== undefined) {
				history.go(historyDelta);
				return;
			}
			void navigate({ href: returnPath, replace: true });
			return;
		}
		void navigate({
			to: "/sources/$mediaSourceId",
			params: { mediaSourceId: props.media.mediaSourceId },
		});
	};

	/** Navigates to adjacent media via Left/Right arrow keys when no dialog, lightbox, or input is active. */
	onSettled(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				event.defaultPrevented ||
				event.isComposing ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey
			) {
				return;
			}
			if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
				return;
			}
			if (
				event.target instanceof Element &&
				event.target.closest(
					"input, textarea, select, [contenteditable], video, audio, media-controller, [role='textbox'], [role='slider'], [role='spinbutton']",
				)
			) {
				return;
			}
			if (event.key === "ArrowLeft" && neighbors().previous) {
				event.preventDefault();
				navigateToNeighbor("previous");
			} else if (event.key === "ArrowRight" && neighbors().next) {
				event.preventDefault();
				navigateToNeighbor("next");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	});

	return (
		<MediaDetailToolbar
			showMetadataLink
			title={props.media.fileName}
			sourceName={props.sourceName}
			onBack={returnToCollection}
			onPrevious={
				neighbors().previous ? () => navigateToNeighbor("previous") : undefined
			}
			onNext={neighbors().next ? () => navigateToNeighbor("next") : undefined}
			actions={props.renderActions?.(props.media, props.onUpdate)}
		/>
	);
}
