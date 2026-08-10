import type { AiHealthResponse } from "@solid-imager/core/domain/tagging/schemas";
import { Match, Show, Switch } from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import { ConfigSkeleton, LoadingRegion } from "../skeleton";
import { cn } from "../utils/cn";
import { V2ManagementHeader } from "../v2/management-layout";
import type { ConfigStateScreenProps } from "./config-state-screen.types";
import { V2ConfigScreen } from "./v2-config-screen";

export type V2ConfigStateScreenProps = ConfigStateScreenProps & {
	checkAiHealth: () => Promise<AiHealthResponse>;
};

export function V2ConfigStateScreen(props: V2ConfigStateScreenProps) {
	const hasData = () => props.data !== undefined;

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
							<V2ConfigScreen
								checkAiHealth={props.checkAiHealth}
								data={data()}
								onSubmit={props.onSubmit}
								onSubmitSuccess={props.onSubmitSuccess}
							/>
						)}
					</Match>
					<Match when={props.state.phase === "pending"}>
						<LoadingRegion label="設定を読み込んでいます...">
							<ConfigSkeleton />
						</LoadingRegion>
					</Match>
					<Match when={props.state.phase === "offline"}>
						<OfflineState
							description="接続が戻ったら、この画面から設定を再取得できます。"
							onRetry={props.onRetry}
						/>
					</Match>
					<Match when={props.state.phase === "error"}>
						<ErrorState
							description="接続を確認して、もう一度お試しください。"
							onRetry={props.onRetry}
							title="設定を取得できませんでした"
						/>
					</Match>
				</Switch>
			</div>
		</section>
	);
}
