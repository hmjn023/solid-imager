import { t } from "@solid-imager/i18n";
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
		return t("apiActivityIndicator.couldNotConnectToTheAPICheckYourNetwork");
	}
	if (activeCount > 0) {
		return t("apiActivityIndicator.waitingForTheAPIResponse");
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
		setIsOnline(getOnlineStatus());
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
		<div aria-atomic="true" aria-live="polite">
			<Show when={isVisible()}>
				<div class="pointer-events-none fixed top-16 left-1/2 z-api-indicator flex max-w-viewport-gutter -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground text-sm shadow-lg md:top-3">
					<Show when={isOnline()}>
						<span
							aria-hidden="true"
							class="inline-block size-2 rounded-full bg-warning-foreground motion-safe:animate-pulse"
						/>
					</Show>
					<Show when={!isOnline()}>
						<span
							aria-hidden="true"
							class="inline-block size-2 rounded-full bg-destructive"
						/>
					</Show>
					<span class="text-foreground">
						{getStatusText(isOnline(), activeCount())}
					</span>
				</div>
			</Show>
		</div>
	);
}
