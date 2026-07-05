import type { ErrorComponentProps } from "@tanstack/solid-router";
import { Link, useRouter, useRouterState } from "@tanstack/solid-router";
import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";

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
				<div class="h-full w-1/2 animate-pulse rounded-full bg-primary" />
			</div>
		</Show>
	);
}

export function RoutePendingScreen() {
	return (
		<section
			aria-live="polite"
			class="mx-auto flex min-h-48 max-w-xl items-center justify-center gap-3 p-6 text-muted-foreground"
			role="status"
		>
			<span
				aria-hidden="true"
				class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent"
			/>
			<span>画面を読み込んでいます...</span>
		</section>
	);
}

export function RouteErrorScreen(props: ErrorComponentProps) {
	const router = useRouter();

	const retry = () => {
		void router.invalidate().finally(() => {
			props.reset();
		});
	};

	return (
		<section
			aria-labelledby="route-error-title"
			class="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
			role="alert"
		>
			<div>
				<h1 class="text-xl font-semibold" id="route-error-title">
					画面を表示できませんでした
				</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					通信状態を確認して、もう一度お試しください。
				</p>
			</div>
			<div class="flex flex-wrap justify-center gap-2">
				<button
					class="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					onClick={retry}
					type="button"
				>
					再試行
				</button>
				<Link
					class="rounded-md border border-border px-4 py-2 hover:bg-muted"
					to="/"
				>
					ホームへ戻る
				</Link>
			</div>
		</section>
	);
}

interface BootstrapStatusScreenProps {
	error?: Error;
	onRetry: () => void;
}

export function BootstrapStatusScreen(props: BootstrapStatusScreenProps) {
	return (
		<section
			aria-live="polite"
			class="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
			role={props.error ? "alert" : "status"}
		>
			<Show
				fallback={
					<>
						<span
							aria-hidden="true"
							class="size-6 animate-spin rounded-full border-2 border-current border-r-transparent text-primary"
						/>
						<div>
							<h1 class="font-semibold">アプリを準備しています</h1>
							<p class="mt-2 text-sm text-muted-foreground">
								保存済みデータを読み込んでいます。
							</p>
						</div>
					</>
				}
				when={props.error}
			>
				<div>
					<h1 class="text-xl font-semibold">アプリを起動できませんでした</h1>
					<p class="mt-2 text-sm text-muted-foreground">
						ローカルデータの初期化に失敗しました。
					</p>
				</div>
				<button
					class="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
					onClick={props.onRetry}
					type="button"
				>
					再試行
				</button>
			</Show>
		</section>
	);
}
