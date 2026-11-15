import {
	MediaAuthorsSection,
	MediaAuthorRow,
	MediaMetadataSection,
	MediaTagBadge,
} from "../media-detail-metadata";
import { t } from "@solid-imager/i18n";
import {
	pixivDownloadItem,
	type PixivArtwork,
} from "@solid-imager/core/external-viewer";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Button } from "../button";
import {
	MediaDetailInspector,
	MediaDetailLayout,
	MediaFileInformation,
} from "../media-detail-layout";
import { MediaViewer, type MediaSource } from "../media-viewer";
import {
	ViewerActions,
	ViewerDetail,
	type ViewerDetailProps,
	ViewerToolbar,
} from "./detail";
import { pixivImageHref } from "./post-media";

export function PixivArtworkDetail(
	props: ViewerDetailProps<PixivArtwork> & {
		apiBase: () => string;
		animation: (id: number) => Promise<string>;
	},
) {
	return (
		<ViewerDetail {...props} provider="pixiv">
			{(post) => {
				const title =
					post.title ||
					t("pixivScreen.pixivValue", { value0: String(post.id) });
				const [index, setIndex] = createSignal(0);
				const [play, setPlay] = createSignal(false);
				const page = () => post.pages[index()];
				const item = createMemo(() => pixivDownloadItem(post, index()));
				const source = createMemo<MediaSource>(() => {
					if (play() && post.animation) {
						return {
							type: "video",
							getUrl: () => props.animation(post.id),
							revokeUrl: (url) => URL.revokeObjectURL(url),
						};
					}
					const url = pixivImageHref(
						props.apiBase(),
						page().original ?? page().preview,
					);
					return { type: "image", getUrl: () => url };
				});
				return (
					<MediaDetailLayout
						header={
							<ViewerToolbar
								{...props}
								title={title}
								provider="pixiv"
								actions={
									<ViewerActions
										item={item()}
										imports={props.imports}
										importLabel={
											post.animation
												? t("pixivArtworkDetail.addUgoiraToImportInbox")
												: t("pixivArtworkDetail.addThisImageToImportInbox")
										}
										sourceLabel={t("pixivArtworkDetail.originalWork")}
										sourceHref={`https://www.pixiv.net/artworks/${post.id}`}
									/>
								}
							/>
						}
						viewer={
							<MediaViewer
								source={source()}
								fileName={title}
								width={page().width}
								height={page().height}
							/>
						}
						sidebar={
							<MediaDetailInspector label={t("pixivArtworkDetail.workDetails")}>
								<Show when={post.pages.length > 1}>
									<MediaMetadataSection
										title={t("pixivArtworkDetail.pagesInThisWork")}
									>
										<nav
											aria-label={t("pixivArtworkDetail.pagesInThisWork")}
											class="flex flex-wrap items-center gap-2"
										>
											<Button
												variant="outline"
												disabled={!index()}
												onClick={() => setIndex((i) => i - 1)}
											>
												{t("pixivArtworkDetail.previousImage")}
											</Button>
											<span aria-live="polite" class="text-sm tabular-nums">
												{index() + 1} / {post.pages.length}
											</span>
											<Button
												variant="outline"
												disabled={index() + 1 >= post.pages.length}
												onClick={() => setIndex((i) => i + 1)}
											>
												{t("pixivArtworkDetail.nextImage")}
											</Button>
										</nav>
									</MediaMetadataSection>
								</Show>
								<Show when={post.isAnimation}>
									<MediaMetadataSection title={t("pixivArtworkDetail.ugoira")}>
										<Show
											when={post.animation}
											fallback={
												<p class="text-muted-foreground text-sm">
													{t("pixivArtworkDetail.couldNotLoadUgoiraFrames")}
												</p>
											}
										>
											<Button
												variant="outline"
												onClick={() => setPlay(!play())}
											>
												{play()
													? t("pixivArtworkDetail.returnToPreviewImage")
													: t("pixivArtworkDetail.playUgoira")}
											</Button>
										</Show>
									</MediaMetadataSection>
								</Show>
								<MediaAuthorsSection>
									<MediaAuthorRow
										name={
											<a
												class="text-primary hover:underline"
												href={`https://www.pixiv.net/users/${post.userId}`}
												target="_blank"
												rel="noopener noreferrer"
											>
												{post.author}
											</a>
										}
									/>
								</MediaAuthorsSection>
								<Show when={post.tags.length}>
									<MediaMetadataSection title={t("pixivArtworkDetail.tags")}>
										<div class="flex flex-wrap gap-2">
											<For each={post.tags}>
												{(tag) => (
													<MediaTagBadge
														name={tag}
														copyLabel={t("pixivArtworkDetail.copyValue", {
															value0: tag,
														})}
													/>
												)}
											</For>
										</div>
									</MediaMetadataSection>
								</Show>
								<MediaFileInformation
									title={t("pixivArtworkDetail.workDetails")}
									rows={[
										[t("pixivArtworkDetail.workID"), post.id],
										[
											t("pixivArtworkDetail.posted"),
											new Date(post.createdAt).toLocaleString(),
										],
										[
											t("collectionInspector.resolution"),
											`${page().width} × ${page().height}`,
										],
									]}
								/>
								<Show when={!item()}>
									<p class="py-4 text-muted-foreground text-xs">
										{t(
											"pixivArtworkDetail.thisImageCannotBeImportedBecauseItsOriginalIs",
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
