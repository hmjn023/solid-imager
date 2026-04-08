import { createFileRoute } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../components/route-placeholder";

export const Route = createFileRoute("/config")({
	component: ConfigRoute,
});

function ConfigRoute() {
	return (
		<RoutePlaceholder
			description="`apps/server/src/routes/config.tsx` を Tauri API client ベースに移植するための受け皿です。設定フォームと保存処理は次の実装で接続します。"
			title="Settings"
		/>
	);
}
