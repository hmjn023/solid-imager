import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { Button } from "@solid-imager/ui/button";
import { MediaDetailScreen } from "@solid-imager/ui/screens/media-detail-screen";
import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
} from "@solid-imager/ui/v2/icons";
import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { MediaActions, MediaSidebar } from "~/components/media/media-sidebar";
import { MediaViewer } from "~/components/media/media-viewer";
import { createServerTransport } from "~/hooks/use-media-source-events";
import {
	mediaDetailsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/infrastructure/api-clients/queries";

interface MediaRouteParams {
	mediaId: string;
	mediaSourceId: string;
}

export const Route = createFileRoute("/v2/sources/$mediaSourceId/$mediaId/")({
	ssr: false,
	remountDeps: ({ params }: { params: MediaRouteParams }) => [
		params.mediaSourceId,
		params.mediaId,
	],
	pendingComponent: () => null,
	component: MediaRoute,
});

function MediaRoute() {
	const params = Route.useParams();
	const mediaSourceId = () => params().mediaSourceId;
	const mediaId = () => params().mediaId;

	return <MediaContent mediaId={mediaId} mediaSourceId={mediaSourceId} />;
}

function MediaDetailHeader(props: {
	media: MediaDetails;
	onUpdate: () => void;
	sourceName: string;
}) {
	const navigate = useNavigate();
	const returnToCollection = () => {
		const returnPath = sessionStorage.getItem("v2:media-return");
		if (
			typeof returnPath === "string" &&
			(returnPath === "/v2/search" ||
				returnPath.startsWith("/v2/search?") ||
				returnPath.startsWith("/v2/sources/"))
		) {
			sessionStorage.removeItem("v2:media-return");
			window.history.back();
			return;
		}
		void navigate({
			to: "/v2/sources/$mediaSourceId",
			params: { mediaSourceId: props.media.mediaSourceId },
		});
	};

	return (
		<header class="z-10 shrink-0 border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-3 py-2 sm:px-4">
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
					<h1 class="truncate font-semibold text-sm text-[var(--v2-text)]">
						{props.media.fileName}
					</h1>
					<p class="truncate text-[11px] text-[var(--v2-text-muted)]">
						{props.sourceName}
					</p>
				</div>

				<div
					class="flex shrink-0 items-center rounded-md border border-[var(--v2-border)] bg-white p-0.5"
					title="一覧コンテキストがないため前後移動は利用できません"
				>
					<Button
						aria-label="前のメディア（利用不可）"
						class="size-9 p-0 md:size-8"
						disabled
						size="icon"
						variant="ghost"
					>
						<ChevronLeft aria-hidden="true" size={16} />
					</Button>
					<Button
						aria-label="次のメディア（利用不可）"
						class="size-9 p-0 md:size-8"
						disabled
						size="icon"
						variant="ghost"
					>
						<ChevronRight aria-hidden="true" size={16} />
					</Button>
				</div>

				<div class="order-last mt-1 w-full md:order-none md:mt-0 md:w-auto">
					<MediaActions
						media={props.media}
						onUpdate={props.onUpdate}
						variant="v2"
					/>
				</div>
			</div>
		</header>
	);
}

function MediaContent(props: {
	mediaId: Accessor<string>;
	mediaSourceId: Accessor<string>;
}) {
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceName = () =>
		mediaSources.data?.find((source) => source.id === props.mediaSourceId())
			?.name ?? "Media source";

	return (
		<MediaDetailScreen
			mediaDetailsQueryOptions={mediaDetailsQueryOptions}
			mediaId={props.mediaId}
			mediaSourceId={props.mediaSourceId}
			renderHeader={(media, _isUpdating, onUpdate) => (
				<MediaDetailHeader
					media={media}
					onUpdate={() => void onUpdate()}
					sourceName={sourceName()}
				/>
			)}
			renderMediaSidebar={(media, isUpdating, onUpdate) => (
				<MediaSidebar
					isUpdating={isUpdating}
					media={media}
					onUpdate={onUpdate}
					variant="v2"
				/>
			)}
			renderMediaViewer={(media) => <MediaViewer media={media} variant="v2" />}
			transport={createServerTransport(props.mediaSourceId)}
			variant="v2"
		/>
	);
}
