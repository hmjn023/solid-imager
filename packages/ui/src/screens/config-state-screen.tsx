import { t } from "@solid-imager/i18n";
import type { AiHealthResponse } from "@solid-imager/core/tagging";
import { Match, Show, Switch } from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import { ConfigSkeleton, LoadingRegion } from "../skeleton";
import { cn } from "../utils/cn";
import {
	MANAGEMENT_CONTENT_PADDING,
	ManagementHeader,
	ManagementScreen,
	ManagementScrollArea,
} from "../workspace/management-layout";
import { ConfigScreen } from "./config-screen";
import type { ConfigStateScreenProps as ConfigStateScreenBaseProps } from "./config-state-screen.types";

export type ConfigStateScreenProps = ConfigStateScreenBaseProps & {
	checkAiHealth: () => Promise<AiHealthResponse>;
};

export function ConfigStateScreen(props: ConfigStateScreenProps) {
	const hasData = () => props.data !== undefined;

	return (
		<ManagementScreen
			header={
				<ManagementHeader
					description={t(
						"configStateScreen.manageApplicationBehaviorAndConnections",
					)}
					title={t("navigation.settings")}
				/>
			}
		>
			<ManagementScrollArea
				class={cn(
					MANAGEMENT_CONTENT_PADDING,
					"scroll-pt-16 scroll-pb-20 lg:scroll-pt-0",
					props.class,
				)}
			>
				<Show when={hasData()}>
					<QueryStatus
						class="mb-2"
						fetchState={props.state.fetchState}
						hasData
						offlineLabel={t("configStateScreen.offlineShowingSavedSettings")}
						updatingLabel={t("configStateScreen.updatingSettings")}
					/>
				</Show>

				<Switch>
					<Match when={props.data}>
						{(data) => (
							<ConfigScreen
								loadMcpCatalog={props.loadMcpCatalog}
								checkAiHealth={props.checkAiHealth}
								data={data()}
								onSubmit={props.onSubmit}
								onSubmitSuccess={props.onSubmitSuccess}
							/>
						)}
					</Match>
					<Match when={props.state.phase === "pending"}>
						<LoadingRegion label={t("configStateScreen.loadingSettings")}>
							<ConfigSkeleton />
						</LoadingRegion>
					</Match>
					<Match when={props.state.phase === "offline"}>
						<OfflineState
							description={t(
								"configStateScreen.reloadSettingsHereWhenYourConnectionReturns",
							)}
							onRetry={props.onRetry}
						/>
					</Match>
					<Match when={props.state.phase === "error"}>
						<ErrorState
							description={t("jobsScreen.checkYourConnectionAndTryAgain")}
							onRetry={props.onRetry}
							title={t("configStateScreen.couldNotLoadSettings")}
						/>
					</Match>
				</Switch>
			</ManagementScrollArea>
		</ManagementScreen>
	);
}
