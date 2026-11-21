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
import {
	createMemo,
	createSignal,
	For,
	onMount,
	Show,
	type JSX,
} from "solid-js";
import { Toggle } from "../toggle";
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
import { PixivPageImports } from "./pixiv-page-imports";
import { PixivPageReader } from "./pixiv-page-reader";
import { readUiStorageValue } from "../ui-storage";

export function PixivArtworkDetail(
	props: ViewerDetailProps<PixivArtwork> & {
		related: (id: number) => JSX.Element;
		historyAction?: JSX.Element;
		bookmarkAction?: (id: number, title: string) => JSX.Element;
		onSearchTag: (tag: string) => void;
		onOpenAuthor: (id: string, name: string) => void;
		apiBase: () => string;
		readingScope: readonly (string | number)[];
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
				const [showOriginal, setShowOriginal] = createSignal(false);
				const canRead = post.pages.length > 1 && !post.isAnimation;
				const readingKey =
					"solid-imager:pixiv-reading-position:v1:" +
					JSON.stringify([...props.readingScope, post.id]);
				onMount(() => {
					if (!canRead) return;
					try {
						const saved = Number(
							readUiStorageValue(sessionStorage, readingKey),
						);
						if (
							Number.isInteger(saved) &&
							saved >= 0 &&
							saved < post.pages.length
						)
							setIndex(saved);
					} catch {
						return;
					}
				});
				function changePage(next: number) {
					if (next === index()) return;
					setShowOriginal(false);
					setIndex(next);
					if (!canRead) return;
					try {
						sessionStorage.setItem(readingKey, String(next));
					} catch {
						return;
					}
				}
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
						(showOriginal() && page().original) || page().preview,
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
									<div class="flex flex-wrap items-center gap-2">
										<Show when={canRead}>
											<PixivPageReader
												pages={post.pages}
												apiBase={props.apiBase()}
												title={title}
												index={index()}
												onPageChange={changePage}
											/>
										</Show>
										<Show
											when={
												!post.isAnimation &&
												page().original &&
												page().original !== page().preview
											}
										>
											<Toggle
												variant="outline"
												class="min-h-11 md:h-9 md:min-h-9 data-[pressed]:bg-primary data-[pressed]:text-primary-foreground"
												pressed={showOriginal()}
												onChange={setShowOriginal}
											>
												{t("pixivArtworkDetail.viewOriginal")}
											</Toggle>
										</Show>
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
										{props.historyAction}
										{props.bookmarkAction?.(post.id, title)}
									</div>
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
						related={props.related(post.id)}
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
												onClick={() => changePage(index() - 1)}
											>
												{t("pixivArtworkDetail.previousImage")}
											</Button>
											<span aria-live="polite" class="text-sm tabular-nums">
												{index() + 1} / {post.pages.length}
											</span>
											<Button
												variant="outline"
												disabled={index() + 1 >= post.pages.length}
												onClick={() => changePage(index() + 1)}
											>
												{t("pixivArtworkDetail.nextImage")}
											</Button>
										</nav>
										<Show when={!post.isAnimation}>
											<PixivPageImports
												artwork={post}
												apiBase={props.apiBase()}
												imports={props.imports}
											/>
										</Show>
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
											<Button
												variant="link"
												class="h-auto whitespace-normal p-0 text-left"
												onClick={() =>
													props.onOpenAuthor(post.userId, post.author)
												}
											>
												{post.author}
											</Button>
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
														onSearch={() => props.onSearchTag(tag)}
														searchLabel={t(
															"danbooruPostDetail.searchForValue",
															{ value0: tag },
														)}
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
