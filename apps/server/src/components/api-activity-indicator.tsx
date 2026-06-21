import { useIsFetching, useIsMutating } from "@tanstack/solid-query";
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
} from "solid-js";
import { isServer } from "solid-js/web";

const SLOW_REQUEST_DELAY_MS = 900;

function getOnlineStatus(): boolean {
	if (isServer || typeof navigator === "undefined") {
		return true;
	}
	return navigator.onLine;
}

function getStatusText(isOnline: boolean, activeCount: number): string {
	if (!isOnline) {
		return "APIに接続できません。ネットワーク接続を確認してください。";
	}
	if (activeCount > 0) {
		return "APIの応答を待っています...";
	}
	return "";
}

export function ApiActivityIndicator() {
	const isFetching = useIsFetching();
	const isMutating = useIsMutating();
	const [isOnline, setIsOnline] = createSignal(getOnlineStatus());
	const [showSlowRequest, setShowSlowRequest] = createSignal(false);

	const activeCount = createMemo(() => isFetching() + isMutating());
	const isActive = createMemo(() => activeCount() > 0);
	const isVisible = createMemo(() => !isOnline() || showSlowRequest());

	createEffect(() => {
		if (!isActive()) {
			setShowSlowRequest(false);
			return;
		}

		const timer = setTimeout(() => {
			setShowSlowRequest(true);
		}, SLOW_REQUEST_DELAY_MS);

		onCleanup(() => {
			clearTimeout(timer);
		});
	});

	onMount(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		onCleanup(() => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		});
	});

	return (
		<Show when={isVisible()}>
			<div class="fixed top-3 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-lg">
				<div class="flex items-center gap-2">
					<Show when={isOnline()}>
						<span class="inline-block size-2 animate-pulse rounded-full bg-warning-foreground" />
					</Show>
					<Show when={!isOnline()}>
						<span class="inline-block size-2 rounded-full bg-destructive" />
					</Show>
					<span class="text-foreground">
						{getStatusText(isOnline(), activeCount())}
					</span>
				</div>
			</div>
		</Show>
	);
}
