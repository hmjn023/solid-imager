import { Link } from "@tanstack/solid-router";

export function NotFoundScreen() {
	return (
		<section
			aria-labelledby="not-found-title"
			class="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
		>
			<h1 class="text-2xl font-semibold" id="not-found-title">
				ページが見つかりません
			</h1>
			<p class="text-sm text-muted-foreground">
				URLが正しいか確認するか、ホームへ戻ってください。
			</p>
			<Link
				class="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
				to="/"
			>
				ホームへ戻る
			</Link>
		</section>
	);
}
