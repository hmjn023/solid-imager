import { createFileRoute } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../../components/route-placeholder";

export const Route = createFileRoute("/sources/")({
	component: SourcesRoute,
});

function SourcesRoute() {
	return (
		<RoutePlaceholder
			description="Source 一覧の UI と操作導線を移植するための route です。同期、追加、編集、削除は Tauri API client に置き換えていきます。"
			title="Media Sources"
		/>
	);
}
