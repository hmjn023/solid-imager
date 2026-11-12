import { t } from "@solid-imager/i18n";
import { Link } from "@tanstack/solid-router";

export function NotFoundScreen() {
	return (
		<section
			aria-labelledby="not-found-title"
			class="mx-auto flex min-h-64 max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
		>
			<h1 class="text-2xl font-semibold" id="not-found-title">
				{t("notFoundScreen.pageNotFound")}
			</h1>
			<p class="text-sm text-muted-foreground">
				{t("notFoundScreen.checkTheURLOrReturnToHome")}
			</p>
			<Link
				class="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
				to="/"
			>
				{t("routerStatus.backToHome")}
			</Link>
		</section>
	);
}
