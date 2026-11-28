import { cn } from "./utils/cn";
import { t } from "@solid-imager/i18n";
import {
	Toolbar,
	ToolbarButton,
	ToolbarSeparator,
} from "@ui-sdk/solid/toolbar";
import {
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	onSettled,
	Show,
	Switch,
} from "solid-js";
import { Button, buttonVariants } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "./dialog";
import { clampMediaPan, type MediaPan } from "./media-viewer-pan";
import { LoadingRegion, Skeleton } from "./skeleton";
import { VideoPlayer } from "./video-player";
import { Maximize2, Minus, Plus, RotateCcw } from "./workspace/icons";

export interface MediaSource {
	type: "image" | "video" | "audio";
	getUrl(signal?: AbortSignal): string | Promise<string>;
	revokeUrl?(url: string): void;
}

export interface MediaViewerProps {
	source: MediaSource;
	fileName: string;
	width?: number;
	height?: number;
}

type ResolvedMedia = {
	source: MediaSource;
	url: string;
};

function AudioPreview(props: { src: string; onError: () => void }) {
	let audio: HTMLAudioElement | undefined;
	onCleanup(() => {
		if (!audio) return;
		audio.pause();
		audio.removeAttribute("src");
		audio.load();
	});
	return (
		<audio
			class="max-w-full"
			controls
			onError={props.onError}
			preload="metadata"
			ref={(element) => {
				audio = element;
			}}
			src={props.src}
		>
			<track kind="captions" />
		</audio>
	);
}

const PAN_DIRECTIONS = [
	{
		name: "left",
		label: () => t("mediaViewer.directionLeft"),
		symbol: "←",
		x: -40,
		y: 0,
	},
	{
		name: "up",
		label: () => t("mediaViewer.directionUp"),
		symbol: "↑",
		x: 0,
		y: -40,
	},
	{
		name: "down",
		label: () => t("mediaViewer.directionDown"),
		symbol: "↓",
		x: 0,
		y: 40,
	},
	{
		name: "right",
		label: () => t("mediaViewer.directionRight"),
		symbol: "→",
		x: 40,
		y: 0,
	},
] as const;

const ZOOM_ICON_BUTTON_CLASS = cn(
	buttonVariants({ size: "icon", variant: "ghost" }),
	"size-11 p-0 data-disabled:pointer-events-none data-disabled:opacity-50 sm:size-8",
);

export function MediaViewer(props: MediaViewerProps) {
	const mediaSource = createMemo(() => props.source);
	const [resolvedMedia, setResolvedMedia] = createSignal<ResolvedMedia>();
	const [viewerLoadState, setViewerLoadState] = createSignal<
		"loading" | "ready" | "error"
	>("loading");
	const [retryCount, setRetryCount] = createSignal(0);
	const currentMedia = () => {
		const resolved = resolvedMedia();
		return resolved?.source === mediaSource() ? resolved : undefined;
	};
	const [zoom, setZoom] = createSignal(1);
	const [pan, setPan] = createSignal({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = createSignal(false);
	const [isFullscreen, setIsFullscreen] = createSignal(false);
	const [isViewerOpen, setIsViewerOpen] = createSignal(false);
	const handleMediaError = (media: ResolvedMedia) => {
		if (media !== currentMedia()) return;
		setResolvedMedia(undefined);
		setViewerLoadState("error");
		setIsViewerOpen(false);
	};
	const [panAnnouncement, setPanAnnouncement] = createSignal("");
	const pointers = new Map<number, { x: number; y: number }>();
	let viewer: HTMLElement | undefined;
	let viewerImage: HTMLImageElement | undefined;
	let panHandle: HTMLButtonElement | undefined;
	let openButton: HTMLButtonElement | undefined;
	let lastPointer: { x: number; y: number } | undefined;
	let pinchStart:
		| { distance: number; pan: { x: number; y: number }; zoom: number }
		| undefined;
	const zoomPercent = createMemo(() => Math.round(zoom() * 100));
	const clampZoom = (value: number) => Math.min(8, Math.max(1, value));
	const clampPan = (nextPan: MediaPan, nextZoom = zoom()) => {
		if (!viewer) return { x: 0, y: 0 };
		return clampMediaPan(
			nextPan,
			nextZoom,
			{ width: viewer.clientWidth, height: viewer.clientHeight },
			{
				width: props.width ?? viewerImage?.naturalWidth ?? 0,
				height: props.height ?? viewerImage?.naturalHeight ?? 0,
			},
		);
	};
	const panImage = (direction: (typeof PAN_DIRECTIONS)[number]) => {
		if (zoom() <= 1) return;
		const current = pan();
		const next = clampPan({
			x: current.x + direction.x,
			y: current.y + direction.y,
		});
		if (next.x === current.x && next.y === current.y) return;
		setPan(next);
		setPanAnnouncement(
			t("mediaViewer.imageMovedValue", { value0: String(direction.label()) }),
		);
	};
	const handleViewerKeyDown = (event: KeyboardEvent) => {
		if (
			event.defaultPrevented ||
			event.isComposing ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey
		) {
			return;
		}
		if (event.key === "+" || event.key === "=") {
			event.preventDefault();
			setZoomAroundPoint(zoom() * 1.25);
			return;
		}
		if (event.key === "-" || event.key === "_") {
			event.preventDefault();
			setZoomAroundPoint(zoom() / 1.25);
			return;
		}
		if (event.key === "0") {
			event.preventDefault();
			resetView();
			return;
		}
		if (event.target !== panHandle || zoom() <= 1 || event.shiftKey) return;
		const direction = PAN_DIRECTIONS.find(
			(item) => event.key.toLowerCase() === `arrow${item.name}`,
		);
		if (!direction) return;
		event.preventDefault();
		panImage(direction);
	};
	const resetView = () => {
		setZoom(1);
		setPan({ x: 0, y: 0 });
		pointers.clear();
		lastPointer = undefined;
		pinchStart = undefined;
		setIsPanning(false);
		setPanAnnouncement("");
	};
	const setZoomAroundPoint = (
		nextValue: number,
		point?: { x: number; y: number },
	) => {
		const previousZoom = zoom();
		const nextZoom = clampZoom(nextValue);
		if (nextZoom === previousZoom) return;
		if (nextZoom === 1) {
			resetView();
			return;
		}
		let nextPan = pan();
		if (viewer && point) {
			const bounds = viewer.getBoundingClientRect();
			const origin = {
				x: point.x - bounds.left - bounds.width / 2,
				y: point.y - bounds.top - bounds.height / 2,
			};
			const ratio = nextZoom / previousZoom;
			nextPan = {
				x: origin.x - (origin.x - nextPan.x) * ratio,
				y: origin.y - (origin.y - nextPan.y) * ratio,
			};
		}
		setZoom(nextZoom);
		setPan(clampPan(nextPan, nextZoom));
	};
	const pointerDistance = () => {
		const points = [...pointers.values()];
		if (points.length < 2) return 0;
		return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
	};
	const handlePointerDown = (event: PointerEvent) => {
		if (mediaSource().type !== "image" || event.button !== 0) return;
		if (
			event.target instanceof Element &&
			event.target.closest("[data-media-viewer-controls]")
		) {
			return;
		}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		panHandle?.focus({ preventScroll: true });
		viewer?.setPointerCapture(event.pointerId);
		if (pointers.size === 2) {
			pinchStart = {
				distance: pointerDistance(),
				pan: pan(),
				zoom: zoom(),
			};
			setIsPanning(true);
			return;
		}
		if (zoom() > 1) {
			lastPointer = { x: event.clientX, y: event.clientY };
			setIsPanning(true);
		}
	};
	const handlePointerMove = (event: PointerEvent) => {
		if (!pointers.has(event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pointers.size >= 2 && pinchStart && pinchStart.distance > 0) {
			const nextZoom = clampZoom(
				pinchStart.zoom * (pointerDistance() / pinchStart.distance),
			);
			setZoom(nextZoom);
			setPan(clampPan(pinchStart.pan, nextZoom));
			return;
		}
		if (!isPanning() || !lastPointer || zoom() <= 1) return;
		const previousPointer = lastPointer;
		const nextPointer = { x: event.clientX, y: event.clientY };
		setPan((current) =>
			clampPan({
				x: current.x + nextPointer.x - previousPointer.x,
				y: current.y + nextPointer.y - previousPointer.y,
			}),
		);
		lastPointer = nextPointer;
	};
	const handlePointerEnd = (event: PointerEvent) => {
		pointers.delete(event.pointerId);
		if (viewer?.hasPointerCapture(event.pointerId)) {
			viewer.releasePointerCapture(event.pointerId);
		}
		pinchStart = undefined;
		lastPointer = undefined;
		setIsPanning(false);
	};
	const handleDragStart = (event: DragEvent) => {
		if (mediaSource().type === "image") {
			event.preventDefault();
		}
	};
	const toggleFullscreen = async () => {
		if (!viewer) return;
		try {
			if (document.fullscreenElement === viewer) {
				await document.exitFullscreen();
				return;
			}
			await viewer.requestFullscreen();
		} catch {
			// Fullscreen can be denied by browser policy; the viewer remains usable.
		}
	};

	createTrackedEffect(() => {
		const source = mediaSource();
		void retryCount();
		const controller = new AbortController();
		let currentUrl: string | null = null;
		let disposed = false;
		setResolvedMedia(undefined);
		setViewerLoadState("loading");
		resetView();

		void (async () => {
			try {
				const url = await source.getUrl(controller.signal);
				if (disposed) {
					source.revokeUrl?.(url);
					return;
				}
				currentUrl = url;
				setResolvedMedia({ source, url });
				setViewerLoadState("ready");
			} catch {
				if (!disposed) {
					setResolvedMedia(undefined);
					setViewerLoadState("error");
				}
			}
		})();

		return () => {
			disposed = true;
			controller.abort();
			if (currentUrl && source.revokeUrl) {
				source.revokeUrl(currentUrl);
			}
		};
	});
	onSettled(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(document.fullscreenElement === viewer);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		const handleResize = () => setPan((current) => clampPan(current));
		window.addEventListener("resize", handleResize);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
			window.removeEventListener("resize", handleResize);
		};
	});

	return (
		<>
			<section
				class={`group/viewer media-viewer-aspect relative flex min-h-0 min-w-0 w-full items-center justify-center overflow-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:aspect-auto lg:h-full ${
					mediaSource().type === "image" && currentMedia()
						? "cursor-zoom-in"
						: ""
				}`}
				data-media-viewer
				style={{
					"--media-aspect":
						props.width && props.height
							? `${props.width} / ${props.height}`
							: "4 / 3",
				}}
			>
				<Switch>
					<Match when={viewerLoadState() === "loading"}>
						<LoadingRegion
							class="h-full w-full"
							label={t("mediaViewer.loadingPreview")}
						>
							<Skeleton class="h-full w-full rounded-none" />
						</LoadingRegion>
					</Match>
					<Match when={viewerLoadState() === "error" || !currentMedia()?.url}>
						<div class="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted px-6 text-center text-muted-foreground">
							<p class="text-sm font-medium text-foreground">
								{mediaSource().type === "video"
									? t("mediaViewer.videoPreviewUnavailable")
									: mediaSource().type === "audio"
										? t("mediaViewer.audioPreviewUnavailable")
										: t("mediaViewer.imagePreviewUnavailable")}
							</p>
							<p
								class="max-w-image-preview truncate rounded-md border border-current/20 px-4 py-1.5 text-xs"
								title={props.fileName}
							>
								{props.fileName}
							</p>
							<Button
								class="min-h-11 sm:min-h-9"
								onClick={() => setRetryCount((count) => count + 1)}
								size="sm"
								type="button"
								variant="outline"
							>
								{t("actions.retry")}
							</Button>
						</div>
					</Match>
					<Match when={mediaSource().type === "video"}>
						<Show keyed when={currentMedia()}>
							{(media) => (
								<VideoPlayer
									fileName={props.fileName}
									onError={() => handleMediaError(media)}
									src={media.url}
								/>
							)}
						</Show>
					</Match>
					<Match when={mediaSource().type === "audio"}>
						<Show keyed when={currentMedia()}>
							{(media) => (
								<AudioPreview
									onError={() => handleMediaError(media)}
									src={media.url}
								/>
							)}
						</Show>
					</Match>
					<Match when={true}>
						<Show keyed when={currentMedia()}>
							{(media) => (
								<button
									aria-label={t("mediaViewer.openValueImageViewer", {
										value0: String(props.fileName),
									})}
									class="h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
									onClick={() => setIsViewerOpen(true)}
									ref={(element) => {
										openButton = element;
									}}
									type="button"
								>
									<img
										alt={props.fileName}
										class="pointer-events-none h-full w-full select-none object-contain"
										draggable="false"
										fetchpriority="high"
										height={props.height}
										onError={() => handleMediaError(media)}
										src={media.url}
										width={props.width}
									/>
								</button>
							)}
						</Show>
					</Match>
				</Switch>
			</section>
			<Dialog
				onOpenChange={(open) => {
					setIsViewerOpen(open);
					if (!open) resetView();
				}}
				open={isViewerOpen()}
			>
				<DialogContent
					class="h-dialog-screen max-h-dialog-screen w-viewport-gutter max-w-none overflow-hidden border-border bg-card p-0 sm:max-h-dialog-screen-sm sm:w-viewport-gutter-sm [&>button]:z-20"
					onCloseAutoFocus={(event) => {
						if (isViewerOpen() || !openButton?.isConnected) return;
						event.preventDefault();
						openButton.focus({ preventScroll: true });
					}}
					onKeyDown={handleViewerKeyDown}
				>
					<DialogTitle class="sr-only">{props.fileName}</DialogTitle>
					<DialogDescription class="sr-only">
						{t("mediaViewer.useTheZoomControlsToZoomUseTheArrow")}
					</DialogDescription>
					<section
						aria-label={t(
							"mediaViewer.valueViewerUseArrowKeysToPanTheEnlarged",
							{ value0: String(props.fileName) },
						)}
						class={cn(
							"relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring media-viewer-stage",
							{
								"cursor-grabbing": isPanning(),
								"cursor-grab": !isPanning() && zoom() > 1,
								"cursor-zoom-in": !isPanning() && zoom() <= 1,
							},
						)}
						data-media-viewer-interactive
						onDblClick={() => {
							if (zoom() > 1) resetView();
							else setZoomAroundPoint(2);
						}}
						onDragStart={handleDragStart}
						onLostPointerCapture={handlePointerEnd}
						onPointerCancel={handlePointerEnd}
						onPointerDown={handlePointerDown}
						onPointerMove={handlePointerMove}
						onPointerUp={handlePointerEnd}
						onWheel={(event) => {
							if (event.deltaY >= 0 && zoom() <= 1) return;
							event.preventDefault();
							setZoomAroundPoint(
								zoom() * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
								{
									x: event.clientX,
									y: event.clientY,
								},
							);
						}}
						ref={(element) => {
							viewer = element;
						}}

						style={{
							"--media-touch-action": zoom() > 1 ? "none" : "pan-y pinch-zoom",
						}}
					>
						<button
							aria-label={t(
								"mediaViewer.panValueUseArrowKeysToMoveTheEnlarged",
								{ value0: String(props.fileName) },
							)}
							class="absolute inset-0 z-10 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							data-media-viewer-pan-handle
							ref={(element) => {
								panHandle = element;
							}}
							type="button"
						/>
						<Show keyed when={currentMedia()}>
							{(media) => (
								<img
									alt={props.fileName}
									class="media-viewer-transform pointer-events-none h-full w-full select-none object-contain motion-safe:transition-transform"
									draggable="false"
									height={props.height}
									onError={() => handleMediaError(media)}
									onLoad={() => setPan((current) => clampPan(current))}
									ref={(element) => {
										viewerImage = element;
									}}
									src={media.url}
									style={{
										"--media-pan-x": `${pan().x}px`,
										"--media-pan-y": `${pan().y}px`,
										"--media-zoom": zoom(),
										"--media-transition-duration": isPanning()
											? "0ms"
											: "150ms",
									}}
									width={props.width}
								/>
							)}
						</Show>
						<fieldset
							aria-label={t("mediaViewer.imageControls")}
							class="absolute right-3 bottom-3 z-20 m-0 flex min-w-0 max-w-full flex-col items-end gap-2 border-0 p-0"
							data-media-viewer-controls
						>
							<fieldset
								aria-label={t("mediaViewer.imagePanControls")}
								class="m-0 flex min-w-0 items-center gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
							>
								<For each={PAN_DIRECTIONS}>
									{(direction) => (
										<Button
											aria-label={t("mediaViewer.panImageValue", {
												value0: String(direction.label()),
											})}
											class="size-11 p-0 sm:size-8"
											disabled={zoom() <= 1}
											onClick={() => panImage(direction)}
											size="icon"
											type="button"
											variant="ghost"
										>
											<span aria-hidden="true">{direction.symbol}</span>
										</Button>
									)}
								</For>
							</fieldset>
							<Toolbar
								aria-label={t("mediaViewer.imageZoomControls")}
								class="flex items-center gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
							>
								<ToolbarButton
									aria-label={t("mediaViewer.zoomOut")}
									class={ZOOM_ICON_BUTTON_CLASS}
									disabled={zoom() <= 1}
									onClick={() => setZoomAroundPoint(zoom() / 1.25)}
								>
									<Minus aria-hidden="true" size={15} />
								</ToolbarButton>
								<ToolbarButton
									aria-label={t("mediaViewer.resetZoomToFit")}
									class="flex min-h-11 min-w-14 items-center justify-center gap-1 rounded-md px-1.5 font-medium text-label-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
									onClick={resetView}
								>
									<RotateCcw aria-hidden="true" size={12} />
									{zoomPercent()}%
								</ToolbarButton>
								<ToolbarButton
									aria-label={t("mediaViewer.zoomIn")}
									class={ZOOM_ICON_BUTTON_CLASS}
									disabled={zoom() >= 8}
									onClick={() => setZoomAroundPoint(zoom() * 1.25)}
								>
									<Plus aria-hidden="true" size={15} />
								</ToolbarButton>
								<ToolbarSeparator class="mx-0.5 h-5 w-px shrink-0 bg-border" />
								<ToolbarButton
									aria-label={
										isFullscreen()
											? t("mediaViewer.exitFullscreen")
											: t("mediaViewer.enterFullscreen")
									}
									class={ZOOM_ICON_BUTTON_CLASS}
									onClick={() => void toggleFullscreen()}
								>
									<Maximize2 aria-hidden="true" size={15} />
								</ToolbarButton>
							</Toolbar>
						</fieldset>
						<span aria-live="polite" class="sr-only">
							{t("mediaViewer.zoomValuePercentValue", {
								value0: String(zoomPercent()),
								value1: String(panAnnouncement()),
							})}
						</span>
					</section>
				</DialogContent>
			</Dialog>
		</>
	);
}

import { createTrackedEffect } from "solid-js";
