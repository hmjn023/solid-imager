import type { JSX, ParentProps } from "solid-js";
import { createSignal, Match, Show, Switch } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "./button";
import type { QueryUiFetchState } from "./query-state";
import { cn } from "./utils/cn";

export type RetryButtonProps = {
	class?: string;
	label?: string;
	onRetry: () => void | Promise<void>;
};

export function RetryButton(props: RetryButtonProps) {
	const [isRetrying, setIsRetrying] = createSignal(false);

	const retry = async () => {
		if (isRetrying()) {
			return;
		}

		setIsRetrying(true);
		try {
			await props.onRetry();
		} catch {
			// The query state renders the retry failure. Keep the control usable.
		} finally {
			setIsRetrying(false);
		}
	};

	return (
		<Button
			aria-busy={isRetrying()}
			class={props.class}
			disabled={isRetrying()}
			onClick={() => void retry()}
			type="button"
		>
			{isRetrying() ? "再試行中..." : (props.label ?? "再試行")}
		</Button>
	);
}

type StatePanelProps = ParentProps<{
	class?: string;
	description?: JSX.Element;
	headingLevel?: 1 | 2;
	icon: JSX.Element;
	role?: "alert" | "status";
	state: "empty" | "error" | "offline";
	title: string;
}>;

function StatePanel(props: StatePanelProps) {
	return (
		<section
			class={cn(
				"flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6 text-center",
				props.state === "error" && "border-destructive/40 bg-error/60",
				props.state === "offline" &&
					"border-warning-foreground/40 bg-warning/60",
				props.state === "empty" && "bg-muted/30",
				props.class,
			)}
			data-state-ui={props.state}
		>
			<div
				aria-hidden="true"
				class={cn(
					"flex size-10 items-center justify-center rounded-full text-lg",
					props.state === "error" && "bg-destructive/15 text-destructive",
					props.state === "offline" &&
						"bg-warning-foreground/15 text-warning-foreground",
					props.state === "empty" && "bg-muted text-muted-foreground",
				)}
			>
				{props.icon}
			</div>
			<div class="max-w-lg space-y-2" role={props.role}>
				<Dynamic
					class="font-semibold text-lg"
					component={props.headingLevel === 1 ? "h1" : "h2"}
				>
					{props.title}
				</Dynamic>
				<Show when={props.description}>
					<p class="text-muted-foreground text-sm">{props.description}</p>
				</Show>
			</div>
			<Show when={props.children}>
				<div class="flex flex-wrap items-center justify-center gap-2">
					{props.children}
				</div>
			</Show>
		</section>
	);
}

export type EmptyStateProps = ParentProps<{
	class?: string;
	description?: JSX.Element;
	headingLevel?: 1 | 2;
	title: string;
}>;

export function EmptyState(props: EmptyStateProps) {
	return (
		<StatePanel
			class={props.class}
			description={props.description}
			headingLevel={props.headingLevel}
			icon="–"
			state="empty"
			title={props.title}
		>
			{props.children}
		</StatePanel>
	);
}

export type ErrorStateProps = ParentProps<{
	class?: string;
	description?: JSX.Element;
	headingLevel?: 1 | 2;
	onRetry?: () => void | Promise<void>;
	retryLabel?: string;
	title: string;
}>;

export function ErrorState(props: ErrorStateProps) {
	return (
		<StatePanel
			class={props.class}
			description={props.description}
			headingLevel={props.headingLevel}
			icon="!"
			role="alert"
			state="error"
			title={props.title}
		>
			<Show when={props.onRetry}>
				{(onRetry) => (
					<RetryButton label={props.retryLabel} onRetry={onRetry()} />
				)}
			</Show>
			{props.children}
		</StatePanel>
	);
}

export type OfflineStateProps = ParentProps<{
	class?: string;
	description?: JSX.Element;
	headingLevel?: 1 | 2;
	onRetry?: () => void | Promise<void>;
	retryLabel?: string;
	title?: string;
}>;

export function OfflineState(props: OfflineStateProps) {
	return (
		<StatePanel
			class={props.class}
			description={props.description}
			headingLevel={props.headingLevel}
			icon="×"
			role="status"
			state="offline"
			title={props.title ?? "オフラインです"}
		>
			<Show when={props.onRetry}>
				{(onRetry) => (
					<RetryButton label={props.retryLabel} onRetry={onRetry()} />
				)}
			</Show>
			{props.children}
		</StatePanel>
	);
}

export type FilterErrorBannerProps = {
	class?: string;
	message: string;
	onRetry: () => void | Promise<void>;
	retryLabel?: string;
};

/** Keeps usable content visible when only supplementary search filters fail. */
export function FilterErrorBanner(props: FilterErrorBannerProps) {
	return (
		<div
			class={cn(
				"flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-foreground/30 bg-warning/40 p-3",
				props.class,
			)}
			data-state-ui="filter-error"
		>
			<p class="text-muted-foreground text-sm" role="status">
				{props.message}
			</p>
			<RetryButton
				class="h-8 px-3 text-xs"
				label={props.retryLabel ?? "フィルターを再取得"}
				onRetry={props.onRetry}
			/>
		</div>
	);
}

export type QueryStatusProps = {
	class?: string;
	errorLabel?: string;
	fetchState: QueryUiFetchState;
	hasData: boolean;
	hasError?: boolean;
	offlineLabel: string;
	updatingLabel: string;
};

export function QueryStatus(props: QueryStatusProps) {
	return (
		<div class={cn("min-h-6", props.class)} data-state-ui-slot="query-status">
			<Switch>
				<Match when={props.fetchState === "background-fetching"}>
					<p
						class="flex items-center gap-2 text-muted-foreground text-sm"
						data-state-ui="background-fetching"
						role="status"
					>
						<span
							aria-hidden="true"
							class="size-2 animate-pulse rounded-full bg-current motion-reduce:animate-none"
						/>
						{props.updatingLabel}
					</p>
				</Match>
				<Match when={props.fetchState === "paused" && props.hasData}>
					<p
						class="flex items-center gap-2 text-muted-foreground text-sm"
						data-state-ui="cached-offline"
						role="status"
					>
						<span
							aria-hidden="true"
							class="size-2 rounded-full bg-warning-foreground"
						/>
						{props.offlineLabel}
					</p>
				</Match>
				<Match when={props.hasError && props.hasData}>
					<p
						class="flex items-center gap-2 text-warning-foreground text-sm"
						data-state-ui="cached-sync-error"
						role="status"
					>
						<span aria-hidden="true" class="size-2 rounded-full bg-current" />
						{props.errorLabel ?? "最新のデータを取得できませんでした"}
					</p>
				</Match>
			</Switch>
		</div>
	);
}
