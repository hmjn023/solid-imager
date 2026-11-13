import { t } from "@solid-imager/i18n";
import { ManagementHeader } from "@solid-imager/ui/management-layout";
import { createFileRoute } from "@tanstack/solid-router";
import { ServerSettingsScreen } from "~/components/server-settings-screen";
import { getServerSettings } from "~/infrastructure/settings/server-settings";

export const Route = createFileRoute("/servers")({
	component: ServersRoute,
});

function ServersRoute() {
	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<ManagementHeader
				description={t("servers.addOrSwitchServersAndCheckConnectionStatus")}
				eyebrow="Workspace"
				title={t("servers.serverConnections")}
			/>
			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 scrollbar-stable">
				<ServerSettingsScreen
					initialSettings={getServerSettings()}
					onActivate={async () => {
						window.location.reload();
					}}
					onNoActiveServer={async () => {
						window.location.reload();
					}}
					showHeader={false}
				/>
			</div>
		</section>
	);
}
