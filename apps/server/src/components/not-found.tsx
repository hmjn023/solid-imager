import { Button } from "@solid-imager/ui/button";
import { Search } from "@solid-imager/ui/workspace/icons";
import { Link } from "@tanstack/solid-router";

export function NotFoundRoute() {
	return (
		<section
			aria-labelledby="not-found-title"
			class="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-background p-6 text-center"
		>
			<span class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
				<Search aria-hidden="true" size={22} />
			</span>
			<div>
				<h1 class="font-semibold text-xl text-foreground" id="not-found-title">
					ページが見つかりません
				</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					URLを確認するか、ライブラリへ戻ってください。
				</p>
			</div>
			<Button as={Link} to="/search">
				ライブラリへ戻る
			</Button>
		</section>
	);
}
