import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
import { Button } from "../button";
import { Binary, ChevronRight, FileText, Image } from "../workspace/icons";
import {
	ManagementHeader,
	ManagementScreen,
	ManagementScrollArea,
} from "../workspace/management-layout";

export type AboutScreenProps = {
	docsHref?: string;
};

const RESOURCE_LINK_CLASS =
	"h-auto min-h-11 w-full justify-start gap-3 whitespace-normal px-2 py-1.5 text-start";

export function AboutScreen(props: AboutScreenProps) {
	return (
		<ManagementScreen
			header={
				<ManagementHeader
					description={t(
						"aboutScreen.solidImagerBringsMediaSourcesSearchConditionsTagsSeries",
					)}
					title={t("aboutScreen.aboutSolidImager")}
					titleId="about-title"
				/>
			}
		>
			<ManagementScrollArea
				aria-labelledby="about-title"
				class="@container px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8"
			>
				<div class="grid rounded-lg border border-border bg-card @3xl:grid-cols-about-layout">
					<div class="flex min-w-0 items-start gap-3 p-4 sm:gap-4 sm:p-6">
						<span class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Image aria-hidden="true" size={22} />
						</span>
						<div class="min-w-0">
							<h2 class="font-semibold text-base text-foreground">
								{t("aboutScreen.aboutSolidImager")}
							</h2>
							<p class="mt-2 max-w-prose text-muted-foreground text-sm leading-6">
								{t(
									"aboutScreen.solidImagerBringsMediaSourcesSearchConditionsTagsSeries",
								)}
							</p>
						</div>
					</div>

					<nav
						aria-labelledby="about-resources-title"
						class="min-w-0 border-border border-t p-4 @3xl:border-s @3xl:border-t-0 sm:p-6"
					>
						<h2 class="font-semibold text-base" id="about-resources-title">
							{t("aboutScreen.documentation")}
						</h2>
						<ul class="mt-3 space-y-1">
							<Show when={props.docsHref}>
								{(href) => (
									<li>
										<Button
											as="a"
											class={RESOURCE_LINK_CLASS}
											href={href()}
											rel="noopener noreferrer"
											target="_blank"
											variant="ghost"
										>
											<span class="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
												<FileText aria-hidden="true" />
											</span>
											<span class="min-w-0 flex-1">
												{t("aboutScreen.aPIDocumentation")}
											</span>
											<ChevronRight
												aria-hidden="true"
												class="text-muted-foreground"
											/>
										</Button>
									</li>
								)}
							</Show>
							<li>
								<Button
									as="a"
									class={RESOURCE_LINK_CLASS}
									href="https://github.com/hmjn023/solid-imager"
									rel="noopener noreferrer"
									target="_blank"
									variant="ghost"
								>
									<span class="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-primary">
										<Binary aria-hidden="true" />
									</span>
									<span class="min-w-0 flex-1">
										{t("aboutScreen.sourceRepository")}
									</span>
									<ChevronRight
										aria-hidden="true"
										class="text-muted-foreground"
									/>
								</Button>
							</li>
						</ul>
					</nav>
				</div>
			</ManagementScrollArea>
		</ManagementScreen>
	);
}
