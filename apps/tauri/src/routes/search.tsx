import { createFileRoute } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../components/route-placeholder";

export const Route = createFileRoute("/search")({
	component: SearchRoute,
});

function SearchRoute() {
	return (
		<RoutePlaceholder
			description="検索画面は query・イベント購読・スクロール復元の依存が多いため、まず route 面を Tauri 側に用意しました。次の段階でクエリ群を移植します。"
			title="Search"
		/>
	);
}
