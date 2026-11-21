import type { PixivArtwork } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import { createEffect, For, onCleanup, onMount } from "solid-js";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "../dialog";
import { pixivImageHref } from "./post-media";

type PixivPageReaderProps = {
	pages: PixivArtwork["pages"];
	apiBase: string;
	title: string;
	index: number;
	onPageChange: (index: number) => void;
};

export function PixivPageReader(props: PixivPageReaderProps) {
	return (
		<Dialog>
			<DialogTrigger as={Button} class="min-h-11 md:min-h-9" variant="outline">
				{t("pixivArtworkDetail.verticalReader")}
			</DialogTrigger>
			<DialogContent
				class="flex h-dvh max-h-none w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-h-none sm:rounded-none"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<PixivReaderContent {...props} />
			</DialogContent>
		</Dialog>
	);
}

function PixivReaderContent(props: PixivPageReaderProps) {
	let reader!: HTMLElement;
	let thumbnails!: HTMLElement;
	const pages: HTMLLIElement[] = [];
	const thumbnailsByPage: HTMLButtonElement[] = [];
	const initialPage = props.index;
	const pageLabel = (index: number) =>
		t("pixivArtworkDetail.pageNumber", { page: index + 1 });
	const preview = (page: PixivArtwork["pages"][number]) =>
		pixivImageHref(props.apiBase, page.preview);

	function jumpTo(index: number) {
		const page = pages[index];
		if (!page || !reader) return;
		reader.scrollTop = page.offsetTop;
		props.onPageChange(index);
		reader.focus({ preventScroll: true });
	}

	function trackPage() {
		if (!reader) return;
		const offset = reader.scrollTop + 1;
		const index = pages.findLastIndex((page) => page.offsetTop <= offset);
		if (index >= 0) props.onPageChange(index);
	}

	onMount(() => {
		const frame = requestAnimationFrame(() => jumpTo(initialPage));
		onCleanup(() => cancelAnimationFrame(frame));
	});

	createEffect(() => {
		const thumbnail = thumbnailsByPage[props.index];
		if (!thumbnail || !thumbnails) return;
		const thumb = thumbnail.getBoundingClientRect();
		const strip = thumbnails.getBoundingClientRect();
		if (thumb.left < strip.left)
			thumbnails.scrollLeft += thumb.left - strip.left - 8;
		else if (thumb.right > strip.right)
			thumbnails.scrollLeft += thumb.right - strip.right + 8;
	});

	return (
		<>
			<header class="shrink-0 border-border border-b bg-background">
				<div class="flex min-w-0 items-center gap-3 py-3 pr-12 pl-3">
					<DialogTitle
						class="min-w-0 flex-1 truncate text-sm"
						title={props.title}
					>
						{props.title}
					</DialogTitle>
					<DialogDescription class="sr-only">
						{t("pixivArtworkDetail.verticalReader")}
					</DialogDescription>
					<span class="shrink-0 text-muted-foreground text-sm tabular-nums">
						{props.index + 1} / {props.pages.length}
					</span>
				</div>
				<nav
					ref={(element) => {
						thumbnails = element;
					}}
					aria-label={t("pixivArtworkDetail.jumpToPage")}
					class="flex gap-2 overflow-x-auto px-3 pt-1 pb-2"
				>
					<For each={props.pages}>
						{(page, index) => (
							<Button
								ref={(element) => {
									thumbnailsByPage[index()] = element;
								}}
								type="button"
								variant="outline"
								aria-label={pageLabel(index())}
								aria-current={props.index === index() ? "page" : undefined}
								class="h-auto w-16 shrink-0 flex-col gap-0.5 p-1 text-xs tabular-nums aria-[current=page]:border-primary aria-[current=page]:bg-accent"
								onClick={() => jumpTo(index())}
							>
								<img
									alt=""
									loading="lazy"
									fetchpriority="low"
									src={preview(page)}
									class="aspect-4/3 w-full rounded-sm object-contain"
								/>
								{index() + 1}
							</Button>
						)}
					</For>
				</nav>
			</header>
			<section
				ref={(element) => {
					reader = element;
				}}
				aria-label={t("pixivArtworkDetail.verticalReader")}
				tabindex="-1"
				class="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset scrollbar-stable"
				onScroll={trackPage}
			>
				<ol class="mx-auto h-full max-w-3xl space-y-2">
					<For each={props.pages}>
						{(page, index) => (
							<li
								ref={(element) => {
									pages[index()] = element;
								}}
								class="last:min-h-full"
							>
								<img
									alt={pageLabel(index())}
									src={preview(page)}
									width={page.width}
									height={page.height}
									loading={initialPage === index() ? "eager" : "lazy"}
									decoding="async"
									class="block aspect-(--pixiv-page-ratio) h-auto w-full object-contain"
									style={{
										"--pixiv-page-ratio": `${page.width} / ${page.height}`,
									}}
								/>
							</li>
						)}
					</For>
				</ol>
			</section>
		</>
	);
}
