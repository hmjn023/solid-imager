import type { Accessor } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";

export function resolveScrollContainer(
	selector: string | undefined,
): HTMLElement | null {
	if (!selector || typeof document === "undefined") return null;
	return document.querySelector<HTMLElement>(selector);
}

export function scrollToPosition(
	selector: string | undefined,
	top: number,
): boolean {
	if (selector) {
		const container = resolveScrollContainer(selector);
		if (!container) return false;
		container.scrollTo({ top });
		return true;
	}
	if (typeof window === "undefined") return false;
	window.scrollTo(0, top);
	return true;
}

export function currentScrollPosition(
	selector: string | undefined,
): number | null {
	if (selector) return resolveScrollContainer(selector)?.scrollTop ?? null;
	return typeof window === "undefined" ? null : window.scrollY;
}

type ScrollMetrics = {
	maximum: number;
};

function getScrollMetrics(selector: string | undefined): ScrollMetrics | null {
	if (selector) {
		const container = resolveScrollContainer(selector);
		if (!container) return null;
		return {
			maximum: Math.max(0, container.scrollHeight - container.clientHeight),
		};
	}

	if (typeof window === "undefined" || typeof document === "undefined") {
		return null;
	}

	return {
		maximum: Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight,
		),
	};
}

export type ScrollRestorationOptions = {
	/** Identifies the result set whose position is being restored. */
	restoreKey: Accessor<string | undefined>;
	getPosition: (key: string) => number;
	setPosition: (key: string, position: number) => void;
	/** The result grid and its scroll container are ready to measure. */
	isReady: Accessor<boolean>;
	hasNextPage: Accessor<boolean>;
	isFetchingNextPage: Accessor<boolean>;
	fetchNextPage: () => Promise<unknown> | unknown;
	scrollContainerSelector?: string;
};

const MAX_RESTORE_PAGE_FETCHES = 100;
const RESTORE_SETTLE_DELAY_MS = 100;

/**
 * Restores a list's scroll position after its initial pages have rendered.
 *
 * Virtualized grids only expose the height of the pages they have loaded. When
 * the saved position is beyond that height, fetch another page and retry after
 * the grid grows instead of letting the browser clamp the scroll position.
 */
export function useScrollRestoration(
	options: ScrollRestorationOptions,
): Accessor<boolean> {
	const [isRestored, setIsRestored] = createSignal(false);
	let activeKey: string | undefined;
	let cancelled = false;
	let fetchCount = 0;
	let fetchInFlight = false;
	let frameId: number | undefined;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;
	let restoreGeneration = 0;

	const requestRestore = () => {
		if (frameId !== undefined || isServer) return;
		frameId = requestAnimationFrame(() => {
			frameId = undefined;
			void attemptRestore();
		});
	};

	const finishAt = (position: number, maximum: number) => {
		const key = activeKey;
		if (!key || cancelled) return;
		const target = Math.min(Math.max(position, 0), maximum);
		scrollToPosition(options.scrollContainerSelector, target);
		if (target === 0) {
			setIsRestored(true);
			return;
		}

		if (settleTimer !== undefined) clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			settleTimer = undefined;
			if (cancelled || !activeKey) return;
			const latestMetrics = getScrollMetrics(options.scrollContainerSelector);
			if (!latestMetrics) {
				requestRestore();
				return;
			}
			scrollToPosition(
				options.scrollContainerSelector,
				Math.min(target, latestMetrics.maximum),
			);
			setIsRestored(true);
		}, RESTORE_SETTLE_DELAY_MS);
	};

	const attemptRestore = async () => {
		const key = activeKey;
		const generation = restoreGeneration;
		if (
			!key ||
			cancelled ||
			isRestored() ||
			settleTimer !== undefined ||
			!options.isReady() ||
			generation !== restoreGeneration
		) {
			return;
		}

		const metrics = getScrollMetrics(options.scrollContainerSelector);
		if (!metrics) {
			requestRestore();
			return;
		}

		const target = Math.max(0, options.getPosition(key));
		if (target <= metrics.maximum + 1) {
			finishAt(target, metrics.maximum);
			return;
		}

		if (!options.hasNextPage() || fetchCount >= MAX_RESTORE_PAGE_FETCHES) {
			finishAt(target, metrics.maximum);
			return;
		}

		if (options.isFetchingNextPage() || fetchInFlight) return;

		fetchCount += 1;
		fetchInFlight = true;
		try {
			await options.fetchNextPage();
		} catch {
			// A failed prefetch should not leave the route permanently blocked.
			if (generation === restoreGeneration) {
				const latestMetrics = getScrollMetrics(options.scrollContainerSelector);
				if (latestMetrics) finishAt(target, latestMetrics.maximum);
			}
		} finally {
			fetchInFlight = false;
			if (!cancelled && !isRestored()) requestRestore();
		}
	};

	const savePosition = () => {
		if (isServer) return;
		if (!isRestored()) return;
		const key = activeKey;
		if (!key) return;
		const position = currentScrollPosition(options.scrollContainerSelector);
		if (position !== null) options.setPosition(key, position);
	};

	createEffect(() => {
		const key = options.restoreKey();
		if (key !== activeKey) {
			savePosition();
			activeKey = key;
			cancelled = false;
			fetchCount = 0;
			if (settleTimer !== undefined) {
				clearTimeout(settleTimer);
				settleTimer = undefined;
			}
			restoreGeneration += 1;
			setIsRestored(false);
		}

		// Track pagination transitions so a completed fetch retries restoration.
		options.hasNextPage();
		options.isFetchingNextPage();
		if (key && options.isReady() && !isRestored() && !cancelled) {
			requestRestore();
		}
	});

	onMount(() => {
		if ("scrollRestoration" in history) {
			history.scrollRestoration = "manual";
		}

		const cancelRestore = () => {
			if (!isRestored()) cancelled = true;
		};
		window.addEventListener("pointerdown", cancelRestore, { passive: true });
		window.addEventListener("wheel", cancelRestore, { passive: true });
		window.addEventListener("touchstart", cancelRestore, { passive: true });
		window.addEventListener("keydown", cancelRestore);
		onCleanup(() => {
			window.removeEventListener("pointerdown", cancelRestore);
			window.removeEventListener("wheel", cancelRestore);
			window.removeEventListener("touchstart", cancelRestore);
			window.removeEventListener("keydown", cancelRestore);
		});
	});

	onCleanup(() => {
		cancelled = true;
		restoreGeneration += 1;
		if (frameId !== undefined) cancelAnimationFrame(frameId);
		if (settleTimer !== undefined) clearTimeout(settleTimer);
		savePosition();
	});

	return isRestored;
}
