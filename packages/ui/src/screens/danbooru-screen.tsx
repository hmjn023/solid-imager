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
import { DanbooruPostDetail } from "../external-viewer/danbooru-post-detail";
import { createViewerImports } from "../external-viewer/detail";
import { danbooruRatingLabel } from "../external-viewer/post-media";
import { createViewerSearch } from "../external-viewer/use-viewer-search";
import {
	ViewerWorkspace,
	type ViewerNavigation,
} from "../external-viewer/workspace";

export type DanbooruScreenProps = ViewerNavigation & {
	search: (input: ExternalSearch) => Promise<DanbooruSearchResult>;
	getPost: (id: number) => Promise<DanbooruPost>;
	suggestTags: (query: string) => Promise<ViewerTag[]>;
	enqueueImport: (item: DownloadItem) => Promise<unknown>;
};

export function DanbooruScreen(props: DanbooruScreenProps) {
	const browse = createViewerSearch(
		"danbooru",
		props.search,
		undefined,
		() => props.selectedPostId,
	);
	const imports = createViewerImports(props.enqueueImport);
	const detail = createQuery(() => ({
		queryKey: ["danbooru", "post", props.selectedPostId],
		queryFn: () => props.getPost(props.selectedPostId ?? 0),
		enabled: !!props.selectedPostId,
		staleTime: 30_000,
		retry: false,
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
			errorTitle="Danbooru を取得できませんでした"
			emptyTitle="該当する投稿がありません"
			describePost={(post) => ({
				title: `Danbooru #${post.id}`,
				thumbnail: post.previewUrl,
				info: `${post.fileExt.toUpperCase()} · ${danbooruRatingLabel(post.rating)}`,
				width: post.width || undefined,
				height: post.height || undefined,
			})}
			renderDetail={(navigation) => (
				<DanbooruPostDetail
					{...navigation}
					query={detail}
					imports={imports}
					onSearchTag={(tag) => {
						browse.submit(tag);
						props.onClosePost();
					}}
				/>
			)}
		/>
	);
}
