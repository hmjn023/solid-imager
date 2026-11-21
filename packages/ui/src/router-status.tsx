import { t } from "@solid-imager/i18n";
import type { ErrorComponentProps } from "@tanstack/solid-router";
import { Link, useRouter, useRouterState } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";
import { ErrorState } from "./async-state";
import { Progress } from "./progress";
import { ScreenSkeleton, type ScreenSkeletonLayout } from "./screen-skeleton";

export const ROUTE_PENDING_DELAY_MS = 300;
export const ROUTE_PENDING_MIN_DURATION_MS = 500;

function useDelayedPending(isPending: () => boolean) {
	const [isVisible, setIsVisible] = createSignal(false);
	let visibleAt = 0;
	let showTimer: ReturnType<typeof setTimeout> | undefined;
	let hideTimer: ReturnType<typeof setTimeout> | undefined;

	const clearTimers = () => {
		clearTimeout(showTimer);
		clearTimeout(hideTimer);
		showTimer = undefined;
		hideTimer = undefined;
	};

	createEffect(() => {
		const pending = isPending();
		const visible = untrack(isVisible);

		clearTimers();

		if (pending) {
			if (!visible) {
				showTimer = setTimeout(() => {
					visibleAt = Date.now();
					setIsVisible(true);
				}, ROUTE_PENDING_DELAY_MS);
			}
			return;
		}

		if (visible) {
			const elapsed = Date.now() - visibleAt;
			const remaining = Math.max(0, ROUTE_PENDING_MIN_DURATION_MS - elapsed);
			hideTimer = setTimeout(() => {
				setIsVisible(false);
			}, remaining);
		}
	});

	onCleanup(clearTimers);

	return isVisible;
}

export function RouteTransitionIndicator() {
	const isRoutePending = useRouterState({
		select: (state) => state.isLoading,
	});
	const isVisible = useDelayedPending(isRoutePending);

	return (
		<Show when={isVisible()}>
			<Progress
				aria-label={t("routerStatus.loadingPage")}
				class="fixed inset-x-0 top-0 z-router-status h-1 rounded-none bg-primary/20 [&>div]:bg-transparent [&>div>div]:w-1/2 [&>div>div]:rounded-full [&>div>div]:motion-safe:animate-pulse"
				indeterminate
			/>
		</Show>
	);
}

export function RoutePendingScreen() {
	return (
		<ScreenSkeleton
			layout="cards"
			loadingLabel={t("routerStatus.loadingPage2")}
			title={t("routerStatus.loadingPage")}
		/>
	);
}

export type RouteDataPendingScreenProps = {
	class?: string;
	title: string;
	description: string;
	layout?: ScreenSkeletonLayout;
	showAction?: boolean;
	showDescription?: boolean;
};

export function RouteDataPendingScreen(props: RouteDataPendingScreenProps) {
	return (
		<ScreenSkeleton
			class={props.class}
			description={props.description}
			layout={props.layout ?? "cards"}
			loadingLabel={props.description}
			showAction={props.showAction}
			showDescription={props.showDescription}
			title={props.title}
		/>
	);
}

export function RouteErrorScreen(props: ErrorComponentProps) {
	const router = useRouter();

	const retry = async () => {
		await router.invalidate().finally(() => {
			props.reset();
		});
	};

	return (
		<div class="flex min-h-full items-center justify-center p-4">
			<ErrorState
				class="mx-auto max-w-xl"
				description={t("routerStatus.checkYourNetworkConnectionAndTryAgain")}
				headingLevel={1}
				onRetry={retry}
				title={t("routerStatus.couldNotDisplayThisPage")}
			>
				<Link
					class="inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					to="/"
				>
					{t("routerStatus.backToHome")}
				</Link>
			</ErrorState>
		</div>
	);
}

interface BootstrapStatusScreenProps {
	error?: Error;
	onRetry: () => void | Promise<void>;
}

export function BootstrapStatusScreen(props: BootstrapStatusScreenProps) {
	return (
		<Show
			fallback={
				<ScreenSkeleton
					description={t("routerStatus.loadingSavedData")}
					layout="cards"
					loadingLabel={t("routerStatus.preparingApplication")}
					showDescription
					title={t("routerStatus.preparingApplication2")}
				/>
			}
			when={props.error}
		>
			<ErrorState
				class="mx-auto max-w-xl"
				description={t("routerStatus.couldNotInitializeLocalData")}
				headingLevel={1}
				onRetry={props.onRetry}
				title={t("routerStatus.couldNotStartTheApplication")}
			/>
		</Show>
	);
}
