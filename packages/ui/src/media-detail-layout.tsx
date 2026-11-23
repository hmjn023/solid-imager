import { t } from "@solid-imager/i18n";
import {
	children,
	createContext,
	createSignal,
	For,
	type JSX,
	onCleanup,
	onMount,
	type ParentProps,
	Show,
	useContext,
} from "solid-js";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	FileText,
} from "./workspace/icons";

const MEDIA_DETAIL_METADATA_ID = "media-detail-metadata";
// Keep both panels swipeable without reserving vertical space for the inactive one.
const DETAIL_PANEL_CLASS =
	"mt-0 w-full min-w-0 shrink-0 snap-start not-data-[selected]:overflow-clip not-data-[selected]:contain-size";
const MediaDetailNavigationContext = createContext<() => void>();
type DetailPanel = "metadata" | "related";

export function MediaDetailLayout(props: {
	header?: JSX.Element;
	viewer: JSX.Element;
	related?: JSX.Element;
	sidebar: JSX.Element;
	switchDetailsOnMobile?: boolean;
}) {
	const related = children(() => props.related);
	const sidebar = children(() => props.sidebar);
	const [isDesktop, setIsDesktop] = createSignal(true);
	const [panel, setPanel] = createSignal<DetailPanel>("metadata");
	const mobilePanels = () =>
		props.switchDetailsOnMobile && !isDesktop() && Boolean(related());
	let panelScroller: HTMLDivElement | undefined;
	let metadata: HTMLElement | undefined;

	onMount(() => {
		const media = window.matchMedia("(min-width: 1024px)");
		const update = () => {
			setPanel("metadata");
			setIsDesktop(media.matches);
		};
		update();
		media.addEventListener("change", update);
		onCleanup(() => media.removeEventListener("change", update));
	});

	const selectPanel = (value: string) => {
		const next = value === "related" ? "related" : "metadata";
		setPanel(next);
		panelScroller?.scrollTo({
			left: next === "related" ? panelScroller.clientWidth : 0,
			behavior: "instant",
		});
	};

	const showMetadata = () => {
		if (mobilePanels()) selectPanel("metadata");
		metadata?.focus({ preventScroll: true });
		metadata?.scrollIntoView({ block: "start", inline: "nearest" });
	};

	const renderMetadata = () => (
		<section
			aria-label={t("mediaDetailLayout.metadata")}
			class="min-w-0 scroll-mt-14 border-border border-t outline-none lg:min-h-0 lg:border-t-0 lg:border-l"
			id={MEDIA_DETAIL_METADATA_ID}
			ref={(element) => {
				metadata = element;
			}}
			tabindex="-1"
		>
			{sidebar()}
		</section>
	);

	return (
		<MediaDetailNavigationContext.Provider value={showMetadata}>
			<div class="flex min-h-0 flex-1 flex-col">
				{props.header}
				<div
					class="min-h-0 flex-1 overflow-y-auto overscroll-contain @container-size lg:grid lg:grid-cols-detail-sidebar lg:overflow-hidden scrollbar-stable"
					data-media-scroll={isDesktop() ? undefined : "detail"}
				>
					<div
						class="min-w-0 lg:min-h-0 lg:snap-y lg:snap-mandatory lg:overflow-y-auto lg:overscroll-contain lg:@container-size scrollbar-stable"
						data-media-scroll={isDesktop() ? "detail" : undefined}
					>
						<div class="lg:h-full lg:snap-start lg:snap-always">
							{props.viewer}
						</div>
						<Show
							when={mobilePanels()}
							fallback={
								<Show when={related()}>
									<div class="empty:hidden lg:min-h-scrollport lg:snap-start lg:snap-always">
										{related()}
									</div>
								</Show>
							}
						>
							<Tabs
								activationMode="manual"
								onChange={selectPanel}
								value={panel()}
							>
								<TabsList
									aria-label={t("mediaDetailLayout.detailPanels")}
									class="sticky top-0 z-10 flex w-full rounded-none border-border border-y bg-card"
								>
									<TabsTrigger
										class="min-h-11 flex-1 data-[selected]:underline"
										value="metadata"
									>
										{t("mediaDetailLayout.metadata")}
									</TabsTrigger>
									<TabsTrigger
										class="min-h-11 flex-1 data-[selected]:underline"
										value="related"
									>
										{t("relatedMedia.relatedMedia")}
									</TabsTrigger>
								</TabsList>
								<div
									class="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
									data-media-detail-panels
									onScroll={({ currentTarget }) => {
										const { scrollLeft, clientWidth } = currentTarget;
										if (scrollLeft >= clientWidth - 1) setPanel("related");
										else if (scrollLeft <= 1) setPanel("metadata");
									}}
									ref={(element) => {
										panelScroller = element;
									}}
								>
									<TabsContent
										aria-hidden={panel() !== "metadata"}
										class={DETAIL_PANEL_CLASS}
										forceMount
										inert={panel() !== "metadata"}
										value="metadata"
									>
										{renderMetadata()}
									</TabsContent>
									<TabsContent
										aria-hidden={panel() !== "related"}
										class={DETAIL_PANEL_CLASS}
										forceMount
										inert={panel() !== "related"}
										value="related"
									>
										{related()}
									</TabsContent>
								</div>
							</Tabs>
						</Show>
					</div>
					<Show when={!mobilePanels()}>{renderMetadata()}</Show>
				</div>
			</div>
		</MediaDetailNavigationContext.Provider>
	);
}

export function MediaDetailToolbar(props: {
	title: string;
	sourceName: string;
	onBack: () => void;
	onPrevious?: () => void;
	onNext?: () => void;
	previousLabel?: string;
	nextLabel?: string;
	showMetadataLink?: boolean;
	actions?: JSX.Element;
}) {
	const showMetadata = useContext(MediaDetailNavigationContext);
	return (
		<header class="z-10 shrink-0 border-border border-b bg-background px-3 py-2 sm:px-4">
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<Button
					aria-label={t("mediaDetailLayout.backToList")}
					class="size-11 shrink-0 p-0 md:size-9"
					onClick={() => props.onBack()}
					size="icon"
					variant="ghost"
				>
					<ArrowLeft aria-hidden="true" size={17} />
				</Button>
				<div class="min-w-0 flex-1">
					<h1
						class="truncate font-semibold text-sm text-foreground"
						title={props.title}
					>
						{props.title}
					</h1>
					<p class="truncate text-label-sm text-muted-foreground">
						{props.sourceName}
					</p>
				</div>
				<div
					class="flex shrink-0 items-center rounded-md border border-border bg-card p-0.5"
					title={
						props.onPrevious || props.onNext
							? t("mediaDetailLayout.navigateToPreviousOrNextMediaInTheList")
							: t(
									"mediaDetailLayout.previousAndNextAreUnavailableWithoutListContext",
								)
					}
				>
					<Button
						aria-label={
							props.previousLabel ?? t("mediaDetailLayout.previousMedia")
						}
						class="size-11 p-0 md:size-8"
						disabled={!props.onPrevious}
						onClick={() => props.onPrevious?.()}
						size="icon"
						variant="ghost"
					>
						<ChevronLeft aria-hidden="true" size={16} />
					</Button>
					<Button
						aria-label={props.nextLabel ?? t("mediaDetailLayout.nextMedia")}
						class="size-11 p-0 md:size-8"
						disabled={!props.onNext}
						onClick={() => props.onNext?.()}
						size="icon"
						variant="ghost"
					>
						<ChevronRight aria-hidden="true" size={16} />
					</Button>
				</div>
				<Show when={props.showMetadataLink}>
					<Button
						aria-controls={MEDIA_DETAIL_METADATA_ID}
						class="min-h-11 min-w-11 shrink-0 gap-1 px-2 lg:hidden"
						onClick={showMetadata}
						size="sm"
						title={t("mediaDetailLayout.editMetadata")}
						variant="outline"
					>
						<FileText aria-hidden="true" class="hidden sm:block" size={16} />
						{t("mediaDetailLayout.editMetadata")}
					</Button>
				</Show>
				<div class="order-last w-full empty:hidden md:order-none md:w-auto">
					{props.actions}
				</div>
			</div>
		</header>
	);
}

export function MediaDetailInspector(props: ParentProps<{ label?: string }>) {
	return (
		<aside
			aria-label={props.label}
			class="min-w-0 divide-y divide-border bg-background px-4 pb-6 text-foreground lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 scrollbar-stable"
		>
			{props.children}
		</aside>
	);
}

export function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) {
		return "0 Bytes";
	}
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function MediaFileInformation(props: {
	title: string;
	rows: Array<[label: string, value: JSX.Element]>;
}) {
	return (
		<div class="space-y-2">
			<h2 class="font-semibold text-sm">{props.title}</h2>
			<dl class="grid grid-cols-label-field gap-x-4 gap-y-2 text-sm">
				<For each={props.rows}>
					{([label, value]) => (
						<>
							<dt class="font-medium text-muted-foreground">{label}</dt>
							<dd class="min-w-0 break-words text-right text-foreground">
								{value}
							</dd>
						</>
					)}
				</For>
			</dl>
		</div>
	);
}
