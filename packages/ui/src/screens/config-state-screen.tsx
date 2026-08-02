import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { Match, Show, Switch } from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import type { QueryUiState } from "../query-state";
import { ConfigSkeleton, LoadingRegion, Skeleton } from "../skeleton";
import { cn } from "../utils/cn";
import { V2ManagementHeader } from "../v2/management-layout";
import { ConfigScreen } from "./config-screen";

export type ConfigStateScreenProps = {
	class?: string;
	data?: AppConfig;
	onRetry: () => void | Promise<void>;
	onSubmit: (value: Partial<AppConfig>) => Promise<void>;
	onSubmitSuccess?: () => void;
	state: QueryUiState<AppConfig>;
	variant?: "default" | "v2";
};

/** Shared server/Tauri query-state wrapper for the settings form. */
export function ConfigStateScreen(props: ConfigStateScreenProps) {
	const hasData = () => props.data !== undefined;
	const content = () => (
		<>
			<Show when={hasData()}>
				<QueryStatus
					class="mb-2"
					fetchState={props.state.fetchState}
					hasData
					offlineLabel="オフラインのため保存済みの設定を表示しています。"
					updatingLabel="設定を更新中..."
				/>
			</Show>

			<Switch>
				<Match when={props.data}>
					{(data) => (
						<ConfigScreen
							data={data()}
							onSubmit={props.onSubmit}
							onSubmitSuccess={props.onSubmitSuccess}
							variant={props.variant}
						/>
					)}
				</Match>
				<Match when={props.state.phase === "pending"}>
					<LoadingRegion label="設定を読み込んでいます...">
						<Show when={props.variant !== "v2"}>
							<div class="mb-6 flex items-center justify-between">
								<h1 class="font-bold text-3xl">Settings</h1>
								<Skeleton class="h-10 w-32" />
							</div>
						</Show>
						<ConfigSkeleton />
					</LoadingRegion>
				</Match>
				<Match when={props.state.phase === "offline"}>
					<div class="space-y-6">
						<Show when={props.variant !== "v2"}>
							<h1 class="font-bold text-3xl">Settings</h1>
						</Show>
						<OfflineState
							description="接続が戻ったら、この画面から設定を再取得できます。"
							onRetry={props.onRetry}
						/>
					</div>
				</Match>
				<Match when={props.state.phase === "error"}>
					<div class="space-y-6">
						<Show when={props.variant !== "v2"}>
							<h1 class="font-bold text-3xl">Settings</h1>
						</Show>
						<ErrorState
							description="接続を確認して、もう一度お試しください。"
							onRetry={props.onRetry}
							title="設定を取得できませんでした"
						/>
					</div>
				</Match>
			</Switch>
		</>
	);

	if (props.variant === "v2") {
		return (
			<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
				<V2ManagementHeader
					description="アプリケーション全体の動作と接続先を管理します。"
					title="Settings"
				/>
				<div
					class={cn(
						"min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 [scrollbar-gutter:stable]",
						props.class,
					)}
				>
					{content()}
				</div>
			</section>
		);
	}

	return (
		<div class={cn("container mx-auto max-w-4xl p-3 sm:p-6", props.class)}>
			{content()}
		</div>
	);
}
