import { Button } from "@solid-imager/ui/button";
import { Search } from "@solid-imager/ui/v2/icons";
import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/v2/$")({
	component: V2NotFoundRoute,
});

function V2NotFoundRoute() {
	return (
		<section
			aria-labelledby="v2-not-found-title"
			class="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-[var(--v2-canvas)] p-6 text-center"
		>
			<span class="flex size-12 items-center justify-center rounded-full bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]">
				<Search aria-hidden="true" size={22} />
			</span>
			<div>
				<h1
					class="font-semibold text-xl text-[var(--v2-text)]"
					id="v2-not-found-title"
				>
					ページが見つかりません
				</h1>
				<p class="mt-2 text-sm text-[var(--v2-text-secondary)]">
					URLを確認するか、ライブラリへ戻ってください。
				</p>
			</div>
			<Button as={Link} to="/v2/search">
				ライブラリへ戻る
			</Button>
		</section>
	);
}
