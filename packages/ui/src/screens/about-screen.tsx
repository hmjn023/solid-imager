import { t } from "@solid-imager/i18n";
import { Badge } from "../badge";
import { Button } from "../button";
import { Card, CardContent, CardHeader, CardTitle } from "../card";

export type AboutScreenProps = {
	docsHref?: string;
};

export function AboutScreen(props: AboutScreenProps) {
	return (
		<section class="h-full min-h-0 overflow-y-auto overscroll-contain bg-background scrollbar-stable">
			<header class="border-border border-b bg-background px-4 py-4 sm:px-6">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h1 class="font-semibold text-xl text-foreground">
							{t("aboutScreen.aboutSolidImager")}
						</h1>
						<p class="mt-1 text-sm text-muted-foreground">
							{t(
								"aboutScreen.aWorkspaceForOrganizingAndSearchingMediaManagingRelated",
							)}
						</p>
					</div>
					<Badge
						class="border-input bg-muted text-muted-foreground"
						variant="outline"
					>
						{t("aboutScreen.currentWorkspace")}
					</Badge>
				</div>
			</header>

			<div class="grid gap-4 p-4 sm:p-6 lg:grid-cols-about-layout">
				<Card class="border-border bg-card shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">
							{t("aboutScreen.mediaFirstWorkspace")}
						</CardTitle>
					</CardHeader>
					<CardContent class="px-5 pb-5 text-sm leading-6 text-muted-foreground">
						<p>
							{t(
								"aboutScreen.solidImagerBringsMediaSourcesSearchConditionsTagsSeries",
							)}
						</p>
						<p class="mt-3">
							{t(
								"aboutScreen.searchManageSourcesTrackJobsChangeSettingsAndRun",
							)}
						</p>
					</CardContent>
				</Card>

				<Card class="border-border bg-card shadow-none">
					<CardHeader class="p-5 pb-3">
						<CardTitle class="text-base">
							{t("aboutScreen.documentation")}
						</CardTitle>
					</CardHeader>
					<CardContent class="space-y-2 px-5 pb-5">
						{props.docsHref && (
							<Button
								as="a"
								class="w-full"
								href={props.docsHref}
								variant="outline"
							>
								{t("aboutScreen.aPIDocumentation")}
							</Button>
						)}
						<Button
							as="a"
							class="w-full"
							href="https://github.com/hmjn023/solid-imager"
							rel="noopener noreferrer"
							target="_blank"
							variant="outline"
						>
							{t("aboutScreen.sourceRepository")}
						</Button>
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
