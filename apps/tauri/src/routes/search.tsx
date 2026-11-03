import type { Media } from "@solid-imager/core/media";
import { saveMediaContext } from "@solid-imager/ui/media-context";
import { createPresetClient } from "@solid-imager/ui/preset-client";
import { SearchWorkspace } from "@solid-imager/ui/screens/search";
import { useSearchWorkspace } from "@solid-imager/ui/search";
import {
	createSearchHistoryClient,
	searchHistoryQuerySchema,
} from "@solid-imager/ui/search/history";
import { toast } from "@solid-imager/ui/toast";
import {
	createFileRoute,
	useLocation,
	useNavigate,
	useRouter,
} from "@tanstack/solid-router";
import { MediaGridItem } from "~/components/media/media-grid-item";
import { ThumbnailImage } from "~/components/media/thumbnail-image";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";
import { SearchHistoryClient as rawSearchHistoryClient } from "~/infrastructure/api/clients/search-history-client";
import {
	bulkCopyToSource,
	bulkDeleteMedia,
	bulkMoveMedia,
	bulkMoveToSource,
	copyMedia,
	deleteMedia,
	moveMedia,
} from "~/infrastructure/api-clients/media-api";
import {
	searchMedia,
	searchSimilar,
	searchSemantic,
} from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import {
	allAuthorsQueryOptions,
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
	tagsQueryOptions,
} from "~/queries";

export const Route = createFileRoute("/search")({
	validateSearch: searchHistoryQuerySchema,
	loader: ({ context }) => {
		void context.queryClient.query(tagsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(mediaSourcesQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allProjectsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allIpsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allCharactersQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
		void context.queryClient.query(allAuthorsQueryOptions()).then(
			() => undefined,
			() => undefined,
		);
	},
	component: SearchRoute,
});

const presetClient = createPresetClient(rawPresetClient);
const historyClient = createSearchHistoryClient(rawSearchHistoryClient);

function SearchRoute() {
	const location = useLocation();
	const navigate = useNavigate();
	const router = useRouter();
	const controller = useSearchWorkspace({
		searchMedia,
		searchSimilar,
		searchSemantic,
		historyClient,
		queries: {
			tags: tagsQueryOptions,
			sources: mediaSourcesQueryOptions,
			projects: allProjectsQueryOptions,
			ips: allIpsQueryOptions,
			characters: allCharactersQueryOptions,
			authors: allAuthorsQueryOptions,
		},
		operations: { deleteMedia, copyMedia, moveMedia },
		notify: toast,
	});
	const { page } = controller;
	const currentReturnPath = () => {
		const current = location();
		return `${current.pathname}${current.searchStr}${current.hash}`;
	};
	const rememberMediaReturn = (media: Media, context?: Media[]) => {
		const returnPath = currentReturnPath();
		saveMediaContext(returnPath, context ?? [media]);
	};
	useMediaSourceEvents(() => controller.selectedSource() || "*", {
		onMediaAdded: page.refreshSearchResults,
		onMediaDeleted: page.refreshSearchResults,
		onMediaChanged: page.refreshSearchResults,
		onMediaCopied: page.refreshSearchResults,
		onMediaMoved: page.refreshSearchResults,
		onAllJobsCompleted: page.refreshSearchResults,
	});
	return (
		<SearchWorkspace
			controller={controller}
			presetClient={presetClient}
			operations={{
				listSources: fetchMediaSources,
				bulkCopyToSource,
				bulkDeleteMedia,
				bulkMoveMedia,
				bulkMoveToSource,
			}}
			detailBasePath={router.history.createHref("/sources")}
			onPrepareMediaDetail={(media, context) =>
				rememberMediaReturn(media, context)
			}
			onOpenMediaDetail={(media, context) => {
				rememberMediaReturn(media, context);
				void navigate({
					params: {
						mediaId: media.id,
						mediaSourceId: media.mediaSourceId,
					},
					to: "/sources/$mediaSourceId/$mediaId",
				});
			}}
			renderMediaItem={(media, options) => (
				<MediaGridItem
					imageLoadPolicy={options?.imageLoadPolicy}
					isBulkSelectMode={options?.isBulkSelectMode}
					isSelected={options?.isSelected}
					isPreviewSelected={options?.isPreviewSelected}
					media={media}
					onContextMenu={options?.onContextMenu}
					onOpenMediaDetail={options?.onOpenMediaDetail}
					onPrepareMediaDetail={options?.onPrepareMediaDetail}
					onPreviewSelect={options?.onPreviewSelect}
					onSelectGesture={options?.onSelectGesture}
					onToggleSelect={options?.onToggleSelect}
					priority={options?.priority}
					sourceRootPath={page.getSourceRootPath(media.mediaSourceId)}
				/>
			)}
			renderMediaPreview={(media) => (
				<ThumbnailImage
					alt={media.fileName}
					class="h-full w-full object-contain"
					height={media.height}
					loading="eager"
					media={media}
					requestedSize={512}
					width={media.width}
				/>
			)}
		/>
	);
}
