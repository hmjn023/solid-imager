import { createFileRoute } from "@tanstack/solid-router";
import { ServerSettingsScreen } from "~/components/server-settings-screen";
import { getServerSettings } from "~/infrastructure/settings/server-settings";

export const Route = createFileRoute("/servers")({
	component: ServersRoute,
});

function ServersRoute() {
	return (
		<ServerSettingsScreen
			initialSettings={getServerSettings()}
			onActivate={async () => {
				window.location.reload();
			}}
			onNoActiveServer={async () => {
				window.location.reload();
			}}
		/>
	);
}
