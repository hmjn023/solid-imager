import {
	createEffect,
	createMemo,
	createSignal,
	For,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "./dialog";
import { clampMediaPan, type MediaPan } from "./media-viewer-pan";
import { VideoPlayer } from "./video-player";
import { Maximize2, Minus, Plus, RotateCcw } from "./workspace/icons";

export interface MediaSource {
	type: "image" | "video" | "audio";
	getUrl(): string | Promise<string>;
	revokeUrl?(url: string): void;
}

export interface MediaViewerProps {
	source: MediaSource;
	fileName: string;
	width?: number;
	height?: number;
}

function AudioPreview(props: { src: string }) {
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
	{ name: "left", symbol: "←", x: -40, y: 0 },
	{ name: "up", symbol: "↑", x: 0, y: -40 },
	{ name: "down", symbol: "↓", x: 0, y: 40 },
	{ name: "right", symbol: "→", x: 40, y: 0 },
] as const;

export function MediaViewer(props: MediaViewerProps) {
	const mediaSource = createMemo(() => props.source);
	const [resolvedMedia, setResolvedMedia] = createSignal<{
		source: MediaSource;
		url: string;
	}>();
	const mediaUrl = () => {
		const resolved = resolvedMedia();
		return resolved?.source === mediaSource() ? resolved.url : undefined;
	};
	const [zoom, setZoom] = createSignal(1);
	const [pan, setPan] = createSignal({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = createSignal(false);
	const [isFullscreen, setIsFullscreen] = createSignal(false);
	const [isViewerOpen, setIsViewerOpen] = createSignal(false);
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
		setPanAnnouncement(`Image moved ${direction.name}`);
	};
	const handlePanKeyDown = (event: KeyboardEvent) => {
		if (
			event.target !== event.currentTarget ||
			event.isComposing ||
			event.altKey ||
			event.ctrlKey ||
			event.metaKey ||
			zoom() <= 1
		)
			return;
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

	createEffect(() => {
		const source = mediaSource();
		let currentUrl: string | null = null;
		let disposed = false;
		setResolvedMedia(undefined);
		resetView();

		void (async () => {
			try {
				const url = await source.getUrl();
				if (disposed) {
					source.revokeUrl?.(url);
					return;
				}
				currentUrl = url;
				setResolvedMedia({ source, url });
			} catch {
				if (!disposed) {
					setResolvedMedia(undefined);
				}
			}
		})();

		onCleanup(() => {
			disposed = true;
			if (currentUrl && source.revokeUrl) {
				source.revokeUrl(currentUrl);
			}
		});
	});
	onMount(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(document.fullscreenElement === viewer);
		};
		document.addEventListener("fullscreenchange", handleFullscreenChange);
		const handleResize = () => setPan((current) => clampPan(current));
		window.addEventListener("resize", handleResize);
		onCleanup(() =>
			document.removeEventListener("fullscreenchange", handleFullscreenChange),
		);
		onCleanup(() => window.removeEventListener("resize", handleResize));
	});

	return (
		<>
			<section
				class={`group/viewer media-viewer-aspect relative flex min-h-0 min-w-0 w-full items-center justify-center overflow-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:aspect-auto lg:h-full ${
					mediaSource().type === "image" ? "cursor-zoom-in" : ""
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
					<Match when={mediaSource().type === "video"}>
						<Show
							fallback={
								<div class="flex h-full max-h-full w-full items-center justify-center bg-foreground text-background">
									Video preview unavailable
								</div>
							}
							when={mediaUrl()}
						>
							{(url) => <VideoPlayer fileName={props.fileName} src={url()} />}
						</Show>
					</Match>
					<Match when={mediaSource().type === "audio"}>
						<Show
							keyed
							fallback={
								<div class="bg-foreground px-8 py-6 text-background">
									Audio preview unavailable
								</div>
							}
							when={mediaUrl()}
						>
							{(url) => <AudioPreview src={url} />}
						</Show>
					</Match>
					<Match when={true}>
						<Show
							fallback={
								<div class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
									<div class="max-w-image-preview truncate rounded-md border border-current/20 px-4 py-2 text-sm">
										{props.fileName}
									</div>
								</div>
							}
							when={mediaUrl()}
						>
							{(url) => (
								<button
									aria-label={`Open ${props.fileName} image viewer`}
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
										draggable={false}
										fetchpriority="high"
										height={props.height}
										src={url()}
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
				>
					<DialogTitle class="sr-only">{props.fileName}</DialogTitle>
					<DialogDescription class="sr-only">
						Use the zoom controls to zoom. Use the arrow keys, direction
						buttons, or drag to pan the enlarged image.
					</DialogDescription>
					<section
						aria-label={`${props.fileName} viewer. Use arrow keys to pan the enlarged image.`}
						class="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring media-viewer-stage"
						classList={{
							"cursor-grabbing": isPanning(),
							"cursor-grab": !isPanning() && zoom() > 1,
							"cursor-zoom-in": !isPanning() && zoom() <= 1,
						}}
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
							aria-label={`Pan ${props.fileName}. Use arrow keys to move the enlarged image.`}
							class="absolute inset-0 z-10 h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
							data-media-viewer-pan-handle
							onKeyDown={handlePanKeyDown}
							ref={(element) => {
								panHandle = element;
							}}
							type="button"
						/>
						<Show when={mediaUrl()}>
							{(url) => (
								<img
									alt={props.fileName}
									class="media-viewer-transform pointer-events-none h-full w-full select-none object-contain motion-safe:transition-transform"
									draggable={false}
									height={props.height}
									onLoad={() => setPan((current) => clampPan(current))}
									ref={(element) => {
										viewerImage = element;
									}}
									src={url()}
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
							aria-label="Image controls"
							class="absolute right-3 bottom-3 z-20 m-0 flex min-w-0 max-w-full flex-col items-end gap-2 border-0 p-0"
							data-media-viewer-controls
						>
							<fieldset
								aria-label="Image pan controls"
								class="m-0 flex min-w-0 items-center gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
							>
								<For each={PAN_DIRECTIONS}>
									{(direction) => (
										<Button
											aria-label={`Pan image ${direction.name}`}
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
							<div
								aria-label="Image zoom controls"
								class="flex items-center gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-lg backdrop-blur"
								role="toolbar"
							>
								<Button
									aria-label="Zoom out"
									class="size-8 p-0"
									disabled={zoom() <= 1}
									onClick={() => setZoomAroundPoint(zoom() / 1.25)}
									size="icon"
									variant="ghost"
								>
									<Minus aria-hidden="true" size={15} />
								</Button>
								<button
									aria-label="Reset zoom to fit"
									class="flex h-8 min-w-14 items-center justify-center gap-1 rounded-md px-1.5 font-medium text-label-sm tabular-nums hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={resetView}
									type="button"
								>
									<RotateCcw aria-hidden="true" size={12} />
									{zoomPercent()}%
								</button>
								<Button
									aria-label="Zoom in"
									class="size-8 p-0"
									disabled={zoom() >= 8}
									onClick={() => setZoomAroundPoint(zoom() * 1.25)}
									size="icon"
									variant="ghost"
								>
									<Plus aria-hidden="true" size={15} />
								</Button>
								<span aria-hidden="true" class="mx-0.5 h-5 w-px bg-border" />
								<Button
									aria-label={
										isFullscreen() ? "Exit fullscreen" : "Enter fullscreen"
									}
									class="size-8 p-0"
									onClick={() => void toggleFullscreen()}
									size="icon"
									variant="ghost"
								>
									<Maximize2 aria-hidden="true" size={15} />
								</Button>
							</div>
						</fieldset>
						<span aria-live="polite" class="sr-only">
							Zoom {zoomPercent()} percent. {panAnnouncement()}
						</span>
					</section>
				</DialogContent>
			</Dialog>
		</>
	);
}
