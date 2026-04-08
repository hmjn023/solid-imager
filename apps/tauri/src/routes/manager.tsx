import { createFileRoute } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../components/route-placeholder";

export const Route = createFileRoute("/manager")({
	component: ManagerRoute,
});

function ManagerRoute() {
	return (
		<RoutePlaceholder
			description="`apps/server/src/routes/manager.tsx` の管理 UI を SPA 側へ移すための route です。データ取得と mutation を Tauri 経由へ差し替えながら移植します。"
			title="Manager"
		/>
	);
}
