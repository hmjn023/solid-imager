import { t } from "@solid-imager/i18n";
import {
	pixivDownloadItem,
	type PixivArtwork,
} from "@solid-imager/core/external-viewer";
import { createMemo, createSignal, For, Show } from "solid-js";
import { Badge } from "../badge";
import { Button } from "../button";
import { ClipboardCopy } from "../clipboard-copy";
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
									<div class="space-y-2">
										<h2 class="font-semibold text-sm">
											{t("pixivArtworkDetail.pagesInThisWork")}
										</h2>
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
									</div>
								</Show>
								<Show when={post.isAnimation}>
									<div class="space-y-2">
										<h2 class="font-semibold text-sm">
											{t("pixivArtworkDetail.ugoira")}
										</h2>
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
									</div>
								</Show>
								<div class="space-y-2">
									<h2 class="font-semibold text-sm">{t("labels.authors")}</h2>
									<a
										class="break-words text-sm text-primary hover:underline"
										href={`https://www.pixiv.net/users/${post.userId}`}
										target="_blank"
										rel="noopener noreferrer"
									>
										{post.author}
									</a>
								</div>
								<Show when={post.tags.length}>
									<div class="space-y-2">
										<h2 class="font-semibold text-sm">
											{t("pixivArtworkDetail.tags")}
										</h2>
										<div class="flex flex-wrap gap-2">
											<For each={post.tags}>
												{(tag) => (
													<Badge
														class="max-w-full break-all"
														variant="secondary"
													>
														{tag}
														<ClipboardCopy
															class="ml-1.5 shrink-0 p-0.5"
															iconSize={12}
															text={tag}
															label={t("pixivArtworkDetail.copyValue", {
																value0: String(tag),
															})}
														/>
													</Badge>
												)}
											</For>
										</div>
									</div>
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
