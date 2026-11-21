import { t } from "@solid-imager/i18n";
import type {
	DanbooruPost,
	DanbooruSearchResult,
} from "@solid-imager/core/danbooru";
import type {
	ExternalSearch,
	ViewerTag,
} from "@solid-imager/core/external-viewer";
import type { DownloadItem } from "@solid-imager/core/media";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, onMount } from "solid-js";
import { DanbooruPostDetail } from "../external-viewer/danbooru-post-detail";
import { createViewerImports } from "../external-viewer/viewer-imports";
import {
	danbooruRatingLabel,
	viewerImageHref,
} from "../external-viewer/post-media";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import { viewerPostQueryOptions } from "../external-viewer/query-options";
import {
	ViewerWorkspace,
	type ViewerNavigation,
} from "../external-viewer/workspace";

export type DanbooruScreenProps = ViewerNavigation & {
	apiBase: () => string;
	search: (input: ExternalSearch) => Promise<DanbooruSearchResult>;
	getPost: (id: number) => Promise<DanbooruPost>;
	suggestTags: (query: string) => Promise<ViewerTag[]>;
	enqueueImport: (item: DownloadItem) => Promise<unknown>;
};

export function DanbooruScreen(props: DanbooruScreenProps) {
	const [mounted, setMounted] = createSignal(false);
	onMount(() => setMounted(true));
	const browse = createViewerSearch(
		"danbooru",
		props.search,
		undefined,
		() => props.selectedPostId,
	);
	const imports = createViewerImports((items) =>
		Promise.all(items.map((item) => props.enqueueImport(item))),
	);
	const detail = createQuery(() => ({
		...viewerPostQueryOptions("danbooru", props.selectedPostId, props.getPost),
		enabled: mounted() && !!props.selectedPostId,
		initialData: () =>
			browse
				.state()
				.data?.posts.find((post) => post.id === props.selectedPostId),
	}));
	return (
		<ViewerWorkspace
			{...props}
			providerName="Danbooru"
			siteUrl="https://danbooru.donmai.us"
			browse={browse}
			errorTitle={t("danbooruScreen.couldNotLoadDanbooru")}
			emptyTitle={t("danbooruScreen.noMatchingPosts")}
			describePost={(post) => ({
				title: t("danbooruScreen.danbooruValue", { value0: String(post.id) }),
				thumbnail:
					post.previewUrl &&
					viewerImageHref(
						props.apiBase(),
						"/api/danbooru-thumbnail",
						post.previewUrl,
					),
				info: `${post.fileExt.toUpperCase()} · ${danbooruRatingLabel(post.rating)}`,
				width: post.width || undefined,
				height: post.height || undefined,
			})}
			renderDetail={(navigation, openNewCollection) => (
				<DanbooruPostDetail
					{...navigation}
					query={detail}
					imports={imports}
					onSearchTag={(tag) => {
						browse.submit(tag);
						openNewCollection();
					}}
				/>
			)}
		/>
	);
}
