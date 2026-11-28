import { Button } from "../button";
import {
	MediaAuthorsSection,
	MediaAuthorRow,
	MediaMetadataSection,
	MediaTagBadge,
} from "../media-detail-metadata";
import { t } from "@solid-imager/i18n";
import {
	danbooruPostToDownloadItem,
	getDanbooruPostUrl,
	getDanbooruPreview,
	type DanbooruPost,
} from "@solid-imager/core/danbooru";
import { createMemo, For, Show } from "solid-js";
import { EmptyState } from "../async-state";
import {
	formatBytes,
	MediaDetailInspector,
	MediaDetailLayout,
	MediaFileInformation,
} from "../media-detail-layout";
import { MediaViewer } from "../media-viewer";
import {
	ViewerActions,
	ViewerDetail,
	type ViewerDetailProps,
	ViewerToolbar,
} from "./detail";
import { danbooruRatingLabel } from "./post-media";

const tagGroups = [
	["copyright", "detail.work"],
	["character", "labels.characters"],
	["general", "pixivArtworkDetail.tags"],
	["meta", "danbooruPostDetail.metadata"],
] as const;

export function DanbooruPostDetail(
	props: ViewerDetailProps<DanbooruPost> & {
		onSearchTag: (tag: string) => void;
	},
) {
	return (
		<ViewerDetail {...props} provider="Danbooru">
			{(post) => {
				const title = () =>
					t("danbooruScreen.danbooruValue", {
						value0: String(post.id),
					});
				const source = createMemo(() => {
					const preview = getDanbooruPreview(post);
					return preview
						? { type: preview.type, getUrl: () => preview.url }
						: undefined;
				});
				const item = createMemo(() => danbooruPostToDownloadItem(post));
				return (
					<MediaDetailLayout
						header={
							<ViewerToolbar
								{...props}
								title={title()}
								provider="Danbooru"
								actions={
									<ViewerActions
										item={item()}
										imports={props.imports}
										importLabel={
											source()?.type === "video"
												? t("danbooruPostDetail.addVideoToImportInbox")
												: t("danbooruPostDetail.addImageToImportInbox")
										}
										sourceLabel={t("danbooruPostDetail.originalPost")}
										sourceHref={getDanbooruPostUrl(post.id)}
									/>
								}
							/>
						}
						viewer={
							<Show
								when={source()}
								fallback={
									<EmptyState
										title={t("danbooruPostDetail.thisPostHasNoPreview")}
										description={t(
											"danbooruPostDetail.visibilityOrFileFormatPreventsPreviewingCheckItOn",
										)}
									/>
								}
							>
								{(mediaSource) => (
									<MediaViewer
										source={mediaSource()}
										fileName={title()}
										width={post.width}
										height={post.height}
									/>
								)}
							</Show>
						}
						sidebar={
							<MediaDetailInspector label={t("danbooruPostDetail.postDetails")}>
								<Show when={post.tags.artist.length}>
									<MediaAuthorsSection>
										<For each={post.tags.artist}>
											{(artist) => (
												<MediaAuthorRow
													name={
														<Button
															type="button"
															variant="link"
															class="h-auto max-w-full whitespace-normal break-words p-0 text-left text-base"
															title={t("danbooruPostDetail.searchForValue", {
																value0: artist,
															})}
															onClick={() => props.onSearchTag(artist)}
														>
															{artist}
														</Button>
													}
												/>
											)}
										</For>
									</MediaAuthorsSection>
								</Show>
								<For each={tagGroups}>
									{([key, label]) => (
										<Show when={post.tags[key].length}>
											<MediaMetadataSection title={t(label)}>
												<div class="flex flex-wrap gap-2">
													<For each={post.tags[key]}>
														{(tag) => (
															<MediaTagBadge
																name={tag}
																variant={
																	key === "general" ? "default" : "secondary"
																}
																searchLabel={t(
																	"danbooruPostDetail.searchForValue",
																	{ value0: tag },
																)}
																onSearch={() => props.onSearchTag(tag)}
															/>
														)}
													</For>
												</div>
											</MediaMetadataSection>
										</Show>
									)}
								</For>
								<MediaFileInformation
									title={t("danbooruPostDetail.postDetails")}
									rows={[
										[
											t("pixivArtworkDetail.posted"),
											new Date(post.createdAt).toLocaleString(),
										],
										[
											t("collectionInspector.resolution"),
											`${post.width} × ${post.height}`,
										],
										[
											t("danbooruPostDetail.format"),
											post.fileExt.toUpperCase(),
										],
										[t("collectionInspector.size"), formatBytes(post.fileSize)],
										[
											t("danbooruPostDetail.rating"),
											danbooruRatingLabel(post.rating),
										],
										[t("danbooruPostDetail.score"), post.score],
									]}
								/>
								<Show when={!item()}>
									<p class="py-4 text-muted-foreground text-xs">
										{t("danbooruPostDetail.unsupportedImport")}
									</p>
								</Show>
							</MediaDetailInspector>
						}
					/>
				);
			}}
		</ViewerDetail>
	);
}
