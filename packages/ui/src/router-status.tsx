import type { ErrorComponentProps } from "@tanstack/solid-router";
import { Link, useRouter, useRouterState } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";
import { ErrorState } from "./async-state";
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
		select: (state) => state.isLoading || state.isTransitioning,
	});
	const isVisible = useDelayedPending(isRoutePending);

	return (
		<Show when={isVisible()}>
			<div
				aria-label="画面を読み込んでいます"
				aria-valuetext="読み込み中"
				class="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-primary/20"
				role="progressbar"
			>
				<div class="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
			</div>
		</Show>
	);
}

export function RoutePendingScreen() {
	return (
		<ScreenSkeleton
			layout="cards"
			loadingLabel="画面を読み込んでいます..."
			title="画面を読み込んでいます"
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
		<div class="container mx-auto p-4">
			<ErrorState
				class="mx-auto max-w-xl"
				description="通信状態を確認して、もう一度お試しください。"
				headingLevel={1}
				onRetry={retry}
				title="画面を表示できませんでした"
			>
				<Link
					class="rounded-md border border-border px-4 py-2 hover:bg-muted"
					to="/"
				>
					ホームへ戻る
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
					description="保存済みデータを読み込んでいます。"
					layout="cards"
					loadingLabel="アプリを準備しています..."
					showDescription
					title="アプリを準備しています"
				/>
			}
			when={props.error}
		>
			<ErrorState
				class="mx-auto max-w-xl"
				description="ローカルデータの初期化に失敗しました。"
				headingLevel={1}
				onRetry={props.onRetry}
				title="アプリを起動できませんでした"
			/>
		</Show>
	);
}
