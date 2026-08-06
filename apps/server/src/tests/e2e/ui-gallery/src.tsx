import type { Media } from "@solid-imager/core/domain/media/schemas";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@solid-imager/ui/alert-dialog";
import { QueryStatus } from "@solid-imager/ui/async-state";
import { Badge } from "@solid-imager/ui/badge";
import { Button, buttonVariants } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Checkbox,
	CheckboxControl,
	CheckboxLabel,
} from "@solid-imager/ui/checkbox";
import {
	CollapsibleContent,
	CollapsibleRoot,
	CollapsibleTrigger,
} from "@solid-imager/ui/collapsible";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemLabel,
	ComboboxTrigger,
} from "@solid-imager/ui/combobox";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@solid-imager/ui/command";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@solid-imager/ui/context-menu";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { useScrollRestoration } from "@solid-imager/ui/hooks/scroll-container";
import { Input } from "@solid-imager/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@solid-imager/ui/popover";
import { Progress, ProgressLabel } from "@solid-imager/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { Skeleton } from "@solid-imager/ui/skeleton";
import { SourceMediaGrid } from "@solid-imager/ui/source-media-grid";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@solid-imager/ui/tabs";
import {
	TextField,
	TextFieldDescription,
	TextFieldErrorMessage,
	TextFieldInput,
	TextFieldLabel,
	TextFieldTextArea,
} from "@solid-imager/ui/text-field";
import { ThumbnailImage } from "@solid-imager/ui/thumbnail-image";
import { Toaster, toast } from "@solid-imager/ui/toast";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { render } from "solid-js/web";
import "../../../app.css";

const OPTIONS = ["Alpha", "Beta", "Gamma"];
const VIRTUAL_GRID_ITEM_COUNT = 1_000;

function createVirtualGridMedia(index: number): Media {
	const timestamp = new Date("2026-01-01T00:00:00.000Z");
	return {
		id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
		mediaSourceId: "00000000-0000-4000-8000-000000000001",
		filePath: `/fixture/${index}.webp`,
		fileName: `fixture-${index}.webp`,
		mediaType: "image",
		width: 512,
		height: 384,
		fileSize: 52_840,
		description: null,
		createdAt: timestamp,
		modifiedAt: timestamp,
		indexedAt: timestamp,
		status: "active",
	};
}

const VIRTUAL_GRID_MEDIA = Array.from(
	{ length: VIRTUAL_GRID_ITEM_COUNT },
	(_, index) => createVirtualGridMedia(index),
);

function VirtualGridGallery() {
	const params = new URLSearchParams(window.location.search);
	const restoreGrid = params.has("restore-grid");
	const remountGrid = params.has("remount-grid");
	const pagedGrid = restoreGrid || remountGrid;
	const fetchDelayMs = remountGrid ? 100 : 10;
	const [loadedCount, setLoadedCount] = createSignal(
		pagedGrid ? 200 : VIRTUAL_GRID_ITEM_COUNT,
	);
	const [isFetchingNextPage, setIsFetchingNextPage] = createSignal(false);
	const [savedScrollTop, setSavedScrollTop] = createSignal(0);
	const [showGrid, setShowGrid] = createSignal(true);
	const [loadMoreRef, setLoadMoreRef] = createSignal<HTMLDivElement>();
	const mediaResults = () => VIRTUAL_GRID_MEDIA.slice(0, loadedCount());
	const fetchNextPage = async () => {
		if (
			!pagedGrid ||
			isFetchingNextPage() ||
			loadedCount() >= VIRTUAL_GRID_ITEM_COUNT
		) {
			return;
		}
		setIsFetchingNextPage(true);
		await new Promise((resolve) => setTimeout(resolve, fetchDelayMs));
		setLoadedCount((count) => Math.min(count + 200, VIRTUAL_GRID_ITEM_COUNT));
		setIsFetchingNextPage(false);
	};
	createEffect(() => {
		const element = loadMoreRef();
		const hasNextPage = loadedCount() < VIRTUAL_GRID_ITEM_COUNT;
		if (!element || !hasNextPage) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) void fetchNextPage();
			},
			{ threshold: 0.5, rootMargin: "2400px" },
		);
		observer.observe(element);
		onCleanup(() => observer.disconnect());
	});
	const saveScrollPosition = () => {
		const scroller = document.querySelector<HTMLElement>(
			"[data-testid=virtual-grid-scroller]",
		);
		if (scroller) setSavedScrollTop(scroller.scrollTop);
	};
	const remount = () => {
		saveScrollPosition();
		setShowGrid(false);
		setTimeout(() => setShowGrid(true), 25);
	};
	const VirtualGridContent = () => {
		useScrollRestoration({
			restoreKey: () => "virtual-grid",
			getPosition: () => savedScrollTop() || (restoreGrid ? 20_000 : 0),
			setPosition: (_key, position) => setSavedScrollTop(position),
			isReady: () => mediaResults().length > 0,
			hasNextPage: () => loadedCount() < VIRTUAL_GRID_ITEM_COUNT,
			isFetchingNextPage,
			fetchNextPage,
			scrollContainerSelector: "[data-media-scroll]",
		});

		return (
			<SourceMediaGrid
				disableContextMenu
				enableVirtualization
				isFetchingNextPage={isFetchingNextPage()}
				itemAspectRatio={4 / 3}
				hasNextPage={loadedCount() < VIRTUAL_GRID_ITEM_COUNT}
				mediaResults={mediaResults}
				mediaSourceId={() => mediaResults()[0]?.mediaSourceId}
				onLoadMore={fetchNextPage}
				renderItem={(media, options) => (
					// The immutable, uniquely-addressed URLs exercise the browser's real
					// memory cache when a virtual row is unmounted and revisited.
					<a
						class="block aspect-[4/3] overflow-hidden rounded-md bg-muted"
						data-media-id={media.id}
						href={`#${media.id}`}
						onContextMenu={options.onContextMenu}
					>
						<ThumbnailImage
							alt={media.fileName}
							class="h-full w-full object-cover"
							enabled={options.imageLoadPolicy?.enabled}
							fetchpriority={options.imageLoadPolicy?.fetchpriority}
							height={384}
							loading={options.imageLoadPolicy?.loading}
							sizes="160px"
							source={{
								getSrcSet: () =>
									`/virtual-thumbnail/${media.id}-256.webp 256w, /virtual-thumbnail/${media.id}-512.webp 512w`,
								getUrl: () => `/virtual-thumbnail/${media.id}-512.webp`,
							}}
							width={512}
						/>
					</a>
				)}
				scrollMode="element"
				setLoadMoreRef={setLoadMoreRef}
				showResultCount={false}
				state={() => ({
					data: mediaResults(),
					error: undefined,
					fetchState: "idle",
					phase: "data",
				})}
				totalCount={VIRTUAL_GRID_ITEM_COUNT}
			/>
		);
	};

	return (
		<main class="flex h-dvh min-h-0 min-w-0 flex-col bg-background p-4 text-foreground">
			<h1 class="sr-only">Virtual media grid performance fixture</h1>
			<Show when={remountGrid}>
				<div class="fixed top-2 left-2 z-10 flex gap-2">
					<button
						data-testid="remount-virtual-grid"
						onClick={remount}
						type="button"
					>
						Remount virtual grid
					</button>
					<button
						data-testid="append-virtual-grid-page"
						onClick={() =>
							setLoadedCount((count) =>
								Math.min(count + 200, VIRTUAL_GRID_ITEM_COUNT),
							)
						}
						type="button"
					>
						Append virtual grid page
					</button>
				</div>
			</Show>
			<div class="shrink-0 h-24" />
			<div class="shrink-0 h-8">
				<QueryStatus
					fetchState={isFetchingNextPage() ? "background-fetching" : "idle"}
					hasData
					hideWhenIdle
					offlineLabel="オフライン"
					updatingLabel="検索結果を更新中..."
				/>
			</div>
			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain"
				data-media-scroll
				data-testid="virtual-grid-scroller"
			>
				<div class="2xl:grid 2xl:grid-cols-[minmax(0,1fr)_clamp(20rem,26vw,26rem)] 2xl:items-start 2xl:gap-4">
					<div class="min-w-0">
						<Show when={showGrid()}>
							<VirtualGridContent />
						</Show>
					</div>
				</div>
			</div>
		</main>
	);
}

function Gallery() {
	const [dark, setDark] = createSignal(false);
	return (
		<div classList={{ dark: dark() }}>
			<Toaster />
			<main class="min-h-dvh bg-background p-4 text-foreground sm:p-8">
				<div class="mx-auto max-w-5xl space-y-8">
					<header class="flex flex-wrap items-center justify-between gap-4">
						<div>
							<h1 class="font-bold text-2xl">Solid UI component gallery</h1>
							<p class="text-muted-foreground text-sm">
								Pinned upstream with solid-imager compatibility behavior.
							</p>
						</div>
						<Button
							onClick={() => setDark((value) => !value)}
							variant="outline"
						>
							Toggle theme
						</Button>
					</header>

					<section aria-labelledby="basic-heading" class="space-y-4">
						<h2 class="font-semibold text-xl" id="basic-heading">
							Basic components
						</h2>
						<div class="flex flex-wrap gap-3">
							<Button>Default</Button>
							<Button variant="secondary">Secondary</Button>
							<Button variant="destructive">Destructive</Button>
							<Button disabled>Disabled</Button>
							<Badge>Badge</Badge>
							<Button onClick={() => toast.success("Saved")}>Show toast</Button>
						</div>
						<Card>
							<CardHeader>
								<CardTitle>Card title</CardTitle>
								<CardDescription>Shared Solid UI card.</CardDescription>
							</CardHeader>
							<CardContent class="space-y-4">
								<Input
									aria-label="Legacy input"
									placeholder="Compatibility input"
								/>
								<Progress aria-label="Import progress" value={60}>
									<ProgressLabel>Import progress</ProgressLabel>
								</Progress>
								<Skeleton class="h-8 w-full" />
							</CardContent>
							<CardFooter>Footer</CardFooter>
						</Card>
					</section>

					<section
						aria-labelledby="form-heading"
						class="grid gap-4 sm:grid-cols-2"
					>
						<h2 class="font-semibold text-xl sm:col-span-2" id="form-heading">
							Forms
						</h2>
						<TextField>
							<TextFieldLabel>Name</TextFieldLabel>
							<TextFieldDescription>
								Programmatically associated help text.
							</TextFieldDescription>
							<TextFieldInput placeholder="Jane Doe" />
						</TextField>
						<TextField validationState="invalid">
							<TextFieldLabel>Description</TextFieldLabel>
							<TextFieldTextArea value="Invalid value" />
							<TextFieldErrorMessage>Review this value.</TextFieldErrorMessage>
						</TextField>
						<Checkbox class="flex items-center gap-2" defaultChecked>
							<CheckboxControl />
							<CheckboxLabel>Enable indexing</CheckboxLabel>
						</Checkbox>
						<Switch class="flex items-center gap-2" defaultChecked>
							<SwitchControl>
								<SwitchThumb />
							</SwitchControl>
							<SwitchLabel>Automatic tagging</SwitchLabel>
						</Switch>
					</section>

					<section
						aria-labelledby="selection-heading"
						class="grid gap-4 sm:grid-cols-2"
					>
						<h2
							class="font-semibold text-xl sm:col-span-2"
							id="selection-heading"
						>
							Selection
						</h2>
						<Select<string>
							itemComponent={(props) => (
								<SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
							)}
							options={OPTIONS}
							placeholder="Choose an option"
						>
							<SelectTrigger aria-label="Select option">
								<SelectValue<string>>
									{(state) => state.selectedOption()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
						<Combobox<string>
							itemComponent={(props) => (
								<ComboboxItem item={props.item}>
									<ComboboxItemLabel>{props.item.rawValue}</ComboboxItemLabel>
								</ComboboxItem>
							)}
							options={OPTIONS}
							placeholder="Search options"
						>
							<ComboboxControl>
								<ComboboxInput aria-label="Search options" />
								<ComboboxTrigger />
							</ComboboxControl>
							<ComboboxContent />
						</Combobox>
					</section>

					<section aria-labelledby="disclosure-heading" class="space-y-4">
						<h2 class="font-semibold text-xl" id="disclosure-heading">
							Disclosure and navigation
						</h2>
						<Tabs defaultValue="first">
							<TabsList>
								<TabsTrigger value="first">First</TabsTrigger>
								<TabsTrigger value="second">Second</TabsTrigger>
							</TabsList>
							<TabsContent value="first">First panel</TabsContent>
							<TabsContent value="second">Second panel</TabsContent>
						</Tabs>
						<CollapsibleRoot.Root>
							<CollapsibleTrigger
								class={buttonVariants({ variant: "outline" })}
							>
								Toggle details
							</CollapsibleTrigger>
							<CollapsibleContent class="pt-2">
								Collapsible content
							</CollapsibleContent>
						</CollapsibleRoot.Root>
						<Command class="max-w-md border">
							<CommandInput placeholder="Search commands" />
							<CommandList>
								<CommandEmpty>No commands.</CommandEmpty>
								<CommandGroup heading="Actions">
									<CommandItem>Open</CommandItem>
									<CommandItem>Save</CommandItem>
								</CommandGroup>
							</CommandList>
						</Command>
					</section>

					<section
						aria-labelledby="overlay-heading"
						class="flex flex-wrap gap-3"
					>
						<h2 class="w-full font-semibold text-xl" id="overlay-heading">
							Overlays
						</h2>
						<Dialog>
							<DialogTrigger class={buttonVariants()}>
								Open dialog
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Example dialog</DialogTitle>
									<DialogDescription>
										Focus stays inside until dismissed.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>Dialog actions</DialogFooter>
							</DialogContent>
						</Dialog>
						<AlertDialog>
							<AlertDialogTrigger
								class={buttonVariants({ variant: "destructive" })}
							>
								Open alert dialog
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Confirm action</AlertDialogTitle>
									<AlertDialogDescription>
										This action needs confirmation.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction>Continue</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
						<Popover>
							<PopoverTrigger class={buttonVariants({ variant: "outline" })}>
								Open popover
							</PopoverTrigger>
							<PopoverContent>Popover content</PopoverContent>
						</Popover>
						<ContextMenu>
							<ContextMenuTrigger class="rounded-md border p-3">
								Right-click target
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem>Context action</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					</section>
				</div>
			</main>
		</div>
	);
}

const root = document.querySelector("#root");
if (!(root instanceof HTMLElement)) {
	throw new Error("Gallery root element was not found");
}
const showVirtualGrid = new URLSearchParams(window.location.search).has(
	"virtual-grid",
);
render(() => (showVirtualGrid ? <VirtualGridGallery /> : <Gallery />), root);
