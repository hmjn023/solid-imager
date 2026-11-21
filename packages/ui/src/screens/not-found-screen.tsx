import { t } from "@solid-imager/i18n";
import { Link } from "@tanstack/solid-router";

export function NotFoundScreen() {
	return (
		<section
			aria-labelledby="not-found-title"
			class="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
		>
			<h1 class="font-semibold text-2xl" id="not-found-title">
				{t("notFoundScreen.pageNotFound")}
			</h1>
			<p class="text-muted-foreground text-sm">
				{t("notFoundScreen.checkTheURLOrReturnToHome")}
			</p>
			<Link
				class="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				to="/"
			>
				{t("routerStatus.backToHome")}
			</Link>
		</section>
	);
}
