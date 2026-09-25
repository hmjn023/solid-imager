import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { useNavigate, useRouter } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { Button } from "./button";
import {
	clearMediaReturnPath,
	findMediaNeighbors,
	readMediaContext,
	readMediaReturnPath,
} from "./media-context";
import { ArrowLeft, ChevronLeft, ChevronRight } from "./workspace/icons";

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
	const neighbors = () => findMediaNeighbors(props.media.id);

	const navigateToNeighbor = (direction: "next" | "previous") => {
		const neighbor = neighbors()[direction];
		if (!neighbor) return;
		void navigate({
			params: {
				mediaId: neighbor.id,
				mediaSourceId: neighbor.mediaSourceId,
			},
			replace: true,
			to: "/sources/$mediaSourceId/$mediaId",
		});
	};

	const returnToCollection = () => {
		const returnPath = readMediaReturnPath();
		if (returnPath && isCollectionRoute(returnPath)) {
			const context = readMediaContext();
			clearMediaReturnPath();
			// Reuse the collection history entry so its search and scroll state
			// survive. Direct links have no preceding collection and use the fallback.
			if (
				context?.returnPath === returnPath &&
				context.returnHistoryIndex !== undefined &&
				router.history.location.state.__TSR_index ===
					context.returnHistoryIndex + 1
			) {
				router.history.back();
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

	return (
		<header class="z-10 shrink-0 border-[var(--workspace-border)] border-b bg-[var(--workspace-surface-subtle)] px-3 py-2 sm:px-4">
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<Button
					aria-label="一覧に戻る"
					class="size-10 shrink-0 p-0 md:size-9"
					onClick={returnToCollection}
					size="icon"
					variant="ghost"
				>
					<ArrowLeft aria-hidden="true" size={17} />
				</Button>

				<div class="min-w-0 flex-1">
					<h1 class="truncate font-semibold text-sm text-[var(--workspace-text)]">
						{props.media.fileName}
					</h1>
					<p class="truncate text-[11px] text-[var(--workspace-text-muted)]">
						{props.sourceName}
					</p>
				</div>

				<div
					class="flex shrink-0 items-center rounded-md border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-0.5"
					title={
						neighbors().previous || neighbors().next
							? "一覧の前後のメディアへ移動"
							: "一覧コンテキストがないため前後移動は利用できません"
					}
				>
					<Button
						aria-label="前のメディア"
						class="size-9 p-0 md:size-8"
						disabled={!neighbors().previous}
						onClick={() => navigateToNeighbor("previous")}
						size="icon"
						variant="ghost"
					>
						<ChevronLeft aria-hidden="true" size={16} />
					</Button>
					<Button
						aria-label="次のメディア"
						class="size-9 p-0 md:size-8"
						disabled={!neighbors().next}
						onClick={() => navigateToNeighbor("next")}
						size="icon"
						variant="ghost"
					>
						<ChevronRight aria-hidden="true" size={16} />
					</Button>
				</div>

				<div class="order-last mt-1 w-full md:order-none md:mt-0 md:w-auto">
					{props.renderActions?.(props.media, props.onUpdate)}
				</div>
			</div>
		</header>
	);
}
