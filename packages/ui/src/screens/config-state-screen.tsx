import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { Match, Show, Switch } from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import type { QueryUiState } from "../query-state";
import { ConfigSkeleton, LoadingRegion, Skeleton } from "../skeleton";
import { cn } from "../utils/cn";
import { ConfigScreen } from "./config-screen";

export type ConfigStateScreenProps = {
	class?: string;
	data?: AppConfig;
	onRetry: () => void | Promise<void>;
	onSubmit: (value: Partial<AppConfig>) => Promise<void>;
	onSubmitSuccess?: () => void;
	state: QueryUiState<AppConfig>;
};

/** Shared server/Tauri query-state wrapper for the settings form. */
export function ConfigStateScreen(props: ConfigStateScreenProps) {
	const hasData = () => props.data !== undefined;

	return (
		<div class={cn("container mx-auto max-w-4xl p-6", props.class)}>
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
						/>
					)}
				</Match>
				<Match when={props.state.phase === "pending"}>
					<LoadingRegion label="設定を読み込んでいます...">
						<div class="mb-6 flex items-center justify-between">
							<h1 class="font-bold text-3xl">Settings</h1>
							<Skeleton class="h-10 w-32" />
						</div>
						<ConfigSkeleton />
					</LoadingRegion>
				</Match>
				<Match when={props.state.phase === "offline"}>
					<div class="space-y-6">
						<h1 class="font-bold text-3xl">Settings</h1>
						<OfflineState
							description="接続が戻ったら、この画面から設定を再取得できます。"
							onRetry={props.onRetry}
						/>
					</div>
				</Match>
				<Match when={props.state.phase === "error"}>
					<div class="space-y-6">
						<h1 class="font-bold text-3xl">Settings</h1>
						<ErrorState
							description="接続を確認して、もう一度お試しください。"
							onRetry={props.onRetry}
							title="設定を取得できませんでした"
						/>
					</div>
				</Match>
			</Switch>
		</div>
	);
}
