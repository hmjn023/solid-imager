import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/v2/about")({
	component: V2AboutRoute,
});

function V2AboutRoute() {
	return (
		<section class="h-full min-h-0 overflow-y-auto overscroll-contain bg-[var(--v2-canvas)] [scrollbar-gutter:stable]">
			<header class="border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-4 py-4 sm:px-6">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 class="font-semibold text-xl text-[var(--v2-text)]">
							About Solid Imager
						</h1>
						<p class="mt-1 text-sm text-[var(--v2-text-secondary)]">
							メディアを整理・検索し、関連情報とバックグラウンド処理を一か所で管理するワークベンチです。
						</p>
					</div>
					<Badge
						class="border-[var(--v2-border-strong)] bg-[var(--v2-surface-muted)] text-[var(--v2-text-secondary)]"
						variant="outline"
					>
						V2 preview
					</Badge>
				</div>
			</header>

			<div class="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
				<Card class="border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">Media-first workspace</CardTitle>
					</CardHeader>
					<CardContent class="px-5 pb-5 text-sm leading-6 text-[var(--v2-text-secondary)]">
						<p>
							Solid
							Imagerは、複数のメディアソース、検索条件、タグ・作品・キャラクターなどの関連情報をまとめて扱います。
							AI補助処理やインポートは、閲覧作業を妨げないバックグラウンドジョブとして実行されます。
						</p>
						<p class="mt-3">
							このV2画面は新しい情報設計への移行検証中です。既存APIで提供できない操作は、実装されるまで明示的に無効化します。
						</p>
					</CardContent>
				</Card>

				<Card class="border-[var(--v2-border)] bg-[var(--v2-surface)] shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">Documentation</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2 px-5 pb-5">
						<Button
							as={Link}
							class="w-full"
							to="/docs/swagger"
							variant="outline"
						>
							API documentation
						</Button>
						<Button
							as="a"
							class="w-full"
							href="https://github.com/hmjn023/solid-imager"
							rel="noopener noreferrer"
							target="_blank"
							variant="outline"
						>
							Source repository
						</Button>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
