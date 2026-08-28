import {
	createEffect,
	createMemo,
	createSignal,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { Button } from "./button";
import { Maximize2, Minus, Plus, RotateCcw } from "./v2/icons";

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

export function V2MediaViewer(props: MediaViewerProps) {
	const [mediaUrl, setMediaUrl] = createSignal<string | null>(null);
	const [zoom, setZoom] = createSignal(1);
	const [pan, setPan] = createSignal({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = createSignal(false);
	const [isFullscreen, setIsFullscreen] = createSignal(false);
	const pointers = new Map<number, { x: number; y: number }>();
	let viewer: HTMLElement | undefined;
	let lastPointer: { x: number; y: number } | undefined;
	let pinchStart:
		| { distance: number; pan: { x: number; y: number }; zoom: number }
		| undefined;
	const zoomPercent = createMemo(() => Math.round(zoom() * 100));
	const clampZoom = (value: number) => Math.min(8, Math.max(1, value));
	const resetView = () => {
		setZoom(1);
		setPan({ x: 0, y: 0 });
		pointers.clear();
		lastPointer = undefined;
		pinchStart = undefined;
		setIsPanning(false);
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
		if (viewer && point) {
			const bounds = viewer.getBoundingClientRect();
			const origin = {
				x: point.x - bounds.left - bounds.width / 2,
				y: point.y - bounds.top - bounds.height / 2,
			};
			const ratio = nextZoom / previousZoom;
			setPan((current) => ({
				x: origin.x - (origin.x - current.x) * ratio,
				y: origin.y - (origin.y - current.y) * ratio,
			}));
		}
		setZoom(nextZoom);
	};
	const pointerDistance = () => {
		const points = [...pointers.values()];
		if (points.length < 2) return 0;
		return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
	};
	const handlePointerDown = (event: PointerEvent) => {
		if (props.source.type !== "image") return;
		if (
			event.target instanceof Element &&
			event.target.closest("[data-media-viewer-controls]")
		) {
			return;
		}
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
			setZoom(
				clampZoom(pinchStart.zoom * (pointerDistance() / pinchStart.distance)),
			);
			setPan(pinchStart.pan);
			return;
		}
		if (!isPanning() || !lastPointer || zoom() <= 1) return;
		const previousPointer = lastPointer;
		const nextPointer = { x: event.clientX, y: event.clientY };
		setPan((current) => ({
			x: current.x + nextPointer.x - previousPointer.x,
			y: current.y + nextPointer.y - previousPointer.y,
		}));
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
		if (props.source.type === "image") {
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
		const source = props.source;
		let currentUrl: string | null = null;
		let disposed = false;
		setMediaUrl(null);
		resetView();

		void (async () => {
			try {
				const url = await source.getUrl();
				if (disposed) {
					source.revokeUrl?.(url);
					return;
				}
				currentUrl = url;
				setMediaUrl(url);
			} catch {
				if (!disposed) {
					setMediaUrl(null);
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
		onCleanup(() =>
			document.removeEventListener("fullscreenchange", handleFullscreenChange),
		);
	});

	return (
		<section
			aria-label={
				props.source.type === "image"
					? `${props.fileName} viewer. Use plus and minus to zoom, and drag to pan.`
					: undefined
			}
			class={`group/viewer relative flex aspect-[var(--media-aspect)] min-h-0 min-w-0 w-full items-center justify-center overflow-hidden bg-[var(--v2-surface)] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--v2-focus)] lg:aspect-auto lg:h-full ${
				isPanning() ? "cursor-grabbing" : zoom() > 1 ? "cursor-grab" : ""
			}`}
			data-media-viewer
			onDblClick={() => {
				if (props.source.type !== "image") return;
				if (zoom() > 1) resetView();
				else setZoomAroundPoint(2);
			}}
			onDragStart={handleDragStart}
			onKeyDown={(event) => {
				if (props.source.type !== "image") return;
				if (event.key === "+" || event.key === "=") {
					event.preventDefault();
					setZoomAroundPoint(zoom() * 1.25);
				} else if (event.key === "-") {
					event.preventDefault();
					setZoomAroundPoint(zoom() / 1.25);
				} else if (event.key === "0") {
					event.preventDefault();
					resetView();
				}
			}}
			onPointerCancel={handlePointerEnd}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerEnd}
			onWheel={(event) => {
				if (props.source.type !== "image") return;
				if (event.deltaY >= 0 && zoom() <= 1) return;
				event.preventDefault();
				setZoomAroundPoint(zoom() * (event.deltaY < 0 ? 1.12 : 1 / 1.12), {
					x: event.clientX,
					y: event.clientY,
				});
			}}
			ref={viewer}
			style={`--media-aspect: ${props.width && props.height ? `${props.width} / ${props.height}` : "4 / 3"}; touch-action: ${zoom() > 1 ? "none" : "pan-y pinch-zoom"}`}
			tabIndex={props.source.type === "image" ? 0 : undefined}
		>
			<Switch>
				<Match when={props.source.type === "video"}>
					<Show
						fallback={
							<div class="flex h-full max-h-full w-full items-center justify-center bg-slate-900 text-white">
								Video preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<video class="h-full max-w-full" controls src={url()}>
								<track kind="captions" />
							</video>
						)}
					</Show>
				</Match>
				<Match when={props.source.type === "audio"}>
					<Show
						fallback={
							<div class="bg-slate-900 px-8 py-6 text-white">
								Audio preview unavailable
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<audio class="max-w-full" controls src={url()}>
								<track kind="captions" />
							</audio>
						)}
					</Show>
				</Match>
				<Match when={true}>
					<Show
						fallback={
							<div class="flex h-full w-full items-center justify-center bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]">
								<div class="max-w-[80%] truncate rounded-md border border-current/20 px-4 py-2 text-sm">
									{props.fileName}
								</div>
							</div>
						}
						when={mediaUrl()}
					>
						{(url) => (
							<img
								alt={props.fileName}
								class="pointer-events-none h-full w-full select-none object-contain motion-safe:transition-transform"
								draggable={false}
								fetchpriority="high"
								height={props.height}
								src={url()}
								style={{
									transform: `translate3d(${pan().x}px, ${pan().y}px, 0) scale(${zoom()})`,
									"transition-duration": isPanning() ? "0ms" : "150ms",
								}}
								width={props.width}
							/>
						)}
					</Show>
				</Match>
			</Switch>
			<Show when={props.source.type === "image" && mediaUrl()}>
				<div
					aria-label="Image zoom controls"
					class="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-lg border border-[var(--v2-border)] bg-[var(--v2-surface-subtle)]/95 p-1 shadow-lg backdrop-blur"
					data-media-viewer-controls
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
						class="flex h-8 min-w-14 items-center justify-center gap-1 rounded-md px-1.5 font-medium text-[11px] tabular-nums hover:bg-[var(--v2-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
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
					<span
						aria-hidden="true"
						class="mx-0.5 h-5 w-px bg-[var(--v2-border)]"
					/>
					<Button
						aria-label={isFullscreen() ? "Exit fullscreen" : "Enter fullscreen"}
						class="size-8 p-0"
						onClick={() => void toggleFullscreen()}
						size="icon"
						variant="ghost"
					>
						<Maximize2 aria-hidden="true" size={15} />
					</Button>
				</div>
				<span aria-live="polite" class="sr-only">
					Zoom {zoomPercent()} percent
				</span>
			</Show>
		</section>
	);
}
