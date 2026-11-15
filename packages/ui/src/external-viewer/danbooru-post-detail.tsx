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
import { For, Show } from "solid-js";
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
	["copyright", t("detail.work")],
	["character", t("labels.characters")],
	["general", t("pixivArtworkDetail.tags")],
	["meta", t("danbooruPostDetail.metadata")],
] as const;

export function DanbooruPostDetail(
	props: ViewerDetailProps<DanbooruPost> & {
		onSearchTag: (tag: string) => void;
	},
) {
	return (
		<ViewerDetail {...props} provider="Danbooru">
			{(post) => {
				const title = t("danbooruScreen.danbooruValue", {
					value0: String(post.id),
				});
				const preview = getDanbooruPreview(post);
				const item = danbooruPostToDownloadItem(post);
				return (
					<MediaDetailLayout
						header={
							<ViewerToolbar
								{...props}
								title={title}
								provider="Danbooru"
								actions={
									<ViewerActions
										item={item}
										imports={props.imports}
										importLabel={t("danbooruPostDetail.addImageToImportInbox")}
										sourceLabel={t("danbooruPostDetail.originalPost")}
										sourceHref={getDanbooruPostUrl(post.id)}
									/>
								}
							/>
						}
						viewer={
							preview ? (
								<MediaViewer
									source={{ type: preview.type, getUrl: () => preview.url }}
									fileName={title}
									width={post.width}
									height={post.height}
								/>
							) : (
								<EmptyState
									title={t("danbooruPostDetail.thisPostHasNoPreview")}
									description={t(
										"danbooruPostDetail.visibilityOrFileFormatPreventsPreviewingCheckItOn",
									)}
								/>
							)
						}
						sidebar={
							<MediaDetailInspector label={t("danbooruPostDetail.postDetails")}>
								<Show when={post.tags.artist.length}>
									<MediaAuthorsSection>
										<For each={post.tags.artist}>
											{(artist) => (
												<MediaAuthorRow
													name={
														<button
															type="button"
															class="text-left text-primary hover:underline"
															title={t("danbooruPostDetail.searchForValue", {
																value0: artist,
															})}
															onClick={() => props.onSearchTag(artist)}
														>
															{artist}
														</button>
													}
												/>
											)}
										</For>
									</MediaAuthorsSection>
								</Show>
								<For each={tagGroups}>
									{([key, label]) => (
										<Show when={post.tags[key].length}>
											<MediaMetadataSection title={label}>
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
								<Show when={!item}>
									<p class="py-4 text-muted-foreground text-xs">
										{t(
											"danbooruPostDetail.postsWithoutDownloadableOriginalsAndNonImageImportsAre",
										)}
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
