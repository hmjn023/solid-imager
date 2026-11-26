import { t } from "@solid-imager/i18n";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import { Link } from "@tanstack/solid-router";
import type { Accessor, JSX } from "solid-js";
import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Button } from "../button";
import { ShortcutKbd } from "../shortcuts/shortcut-kbd";
import {
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "../sidebar";
import { TooltipContent, TooltipTrigger } from "../tooltip";
import { cn } from "../utils/cn";
import {
	CircleHelp,
	Database,
	FileText,
	Image,
	Palette,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
	Tag,
} from "../workspace/icons";
import { NAVIGATION_ITEMS, NavigationItem } from "./navigation";
import { SidebarTooltip } from "./sidebar-tooltip";
import { SourceList } from "./source-list";

export type JobsBadgeCounts = {
	active: number;
	failed: number;
};

export type SidebarProps = {
	"aria-label"?: string;
	as?: "aside" | "div";
	class?: string;
	apiDocsHref?: string;
	inDrawer?: boolean;
	jobsCounts?: JobsBadgeCounts;
	serverConnectionsHref?: string;
	expanded: boolean;
	mediaSources: SafeMediaSource[];
	onAddSource: () => void;
	onCollapseToggle?: () => void;
	onDeleteSource: (source: SafeMediaSource) => void;
	onEditSource: (source: SafeMediaSource) => void;
	onNavigate?: () => void;
	onOpenCommandPalette?: () => void;
	onSyncSource: (source: SafeMediaSource) => void;
	renderPendingDownloadsIndicator?: (compact: Accessor<boolean>) => JSX.Element;
};

function formatBadgeCount(count: number): string {
	return count > 99 ? "99+" : String(count);
}

function getJobsAccessibleLabel(counts?: JobsBadgeCounts): string {
	const active = counts?.active ?? 0;
	const failed = counts?.failed ?? 0;
	if (active > 0 && failed > 0) {
		return t("navigation.jobsActiveAndFailed", {
			active: String(active),
			failed: String(failed),
		});
	}
	if (active > 0) {
		return t("navigation.jobsActive", { active: String(active) });
	}
	if (failed > 0) {
		return t("navigation.jobsFailed", { failed: String(failed) });
	}
	return t("navigation.jobs");
}

export function Sidebar(props: SidebarProps) {
	return (
		<Dynamic
			aria-label={props["aria-label"]}
			class={cn(
				// oxlint-disable-next-line shadcn/no-arbitrary-values -- Uses canonical --workspace-surface-subtle token from theme.css (DESIGN.md sidebar).
				"flex min-h-0 flex-col bg-[var(--workspace-surface-subtle)] text-foreground *:shrink-0",
				props.inDrawer
					? "h-auto min-h-full overflow-visible"
					: "h-full overflow-y-auto overscroll-contain scrollbar-stable",
				props.class,
			)}
			component={props.as ?? "div"}
			data-state={props.expanded ? "expanded" : "collapsed"}
		>
			<SidebarHeader>
				<div
					class={cn(
						props.expanded
							? "group flex h-12 items-center gap-2 px-2"
							: "group flex flex-col items-center gap-1.5 py-1",
						props.inDrawer && props.expanded && "pr-12",
					)}
				>
					<SidebarTooltip disabled={props.expanded}>
						<TooltipTrigger
							aria-label={t("sidebar.solidImagerLibrary")}
							as={Link}
							class="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
							classList={{ "flex-1": props.expanded }}
							onClick={props.onNavigate}
							to="/search"
						>
							<span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
								<Image aria-hidden="true" size={17} />
							</span>
							<strong
								class="min-w-0 flex-1 truncate font-semibold text-base text-foreground"
								classList={{ hidden: !props.expanded }}
							>
								{t("sidebar.solidImager")}
							</strong>
						</TooltipTrigger>
						<TooltipContent>{t("sidebar.solidImagerLibrary")}</TooltipContent>
					</SidebarTooltip>
					<Show when={props.onCollapseToggle}>
						{(onCollapseToggle) => (
							<SidebarTooltip disabled={props.expanded}>
								<TooltipTrigger
									aria-label={t(
										props.expanded
											? "sidebar.collapseSidebar"
											: "sidebar.expandSidebar",
									)}
									as={Button}
									class={cn(
										"size-11 shrink-0 p-0 text-muted-foreground md:size-8",
										props.expanded &&
											"opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none",
									)}
									onClick={onCollapseToggle()}
									size="icon"
									variant="ghost"
								>
									<Show
										fallback={<PanelLeftOpen aria-hidden="true" size={17} />}
										when={props.expanded}
									>
										<PanelLeftClose aria-hidden="true" size={17} />
									</Show>
								</TooltipTrigger>
								<TooltipContent>{t("sidebar.expandSidebar")}</TooltipContent>
							</SidebarTooltip>
						)}
					</Show>
				</div>

				<Show when={props.onOpenCommandPalette}>
					{(onOpenCommandPalette) => (
						<SidebarTooltip disabled={props.expanded}>
							<TooltipTrigger
								aria-label={t("sidebar.quickActions")}
								as={Button}
								class={cn(
									"h-10 w-full border border-border bg-card text-muted-foreground shadow-none hover:bg-muted",
									props.expanded
										? "justify-start gap-2 px-3"
										: "justify-center px-0",
								)}
								onClick={onOpenCommandPalette()}
								variant="outline"
							>
								<Search aria-hidden="true" class="shrink-0" size={16} />
								<span
									class="min-w-0 flex-1 truncate text-left"
									classList={{ hidden: !props.expanded }}
								>
									{t("sidebar.quickActions")}
								</span>
								<Show when={props.expanded}>
									<ShortcutKbd
										class="min-h-5 text-label-xs"
										shortcutId="commandPalette"
									/>
								</Show>
							</TooltipTrigger>
							<TooltipContent>{t("sidebar.quickActions")}</TooltipContent>
						</SidebarTooltip>
					)}
				</Show>
			</SidebarHeader>

			<SidebarContent class="min-h-fit shrink-0 gap-1 overflow-visible px-2 text-sm">
				<nav aria-label={t("sidebar.primaryNavigation")}>
					<SidebarMenu>
						<NavigationItem
							expanded={props.expanded}
							icon={NAVIGATION_ITEMS[0].icon}
							label={t(NAVIGATION_ITEMS[0].labelKey)}
							onClick={props.onNavigate}
							to={NAVIGATION_ITEMS[0].to}
						>
							<ShortcutKbd
								class="min-h-5 text-label-xs"
								shortcutId={NAVIGATION_ITEMS[0].shortcutId}
							/>
						</NavigationItem>
						<Show when={props.renderPendingDownloadsIndicator}>
							{(renderPendingDownloadsIndicator) => (
								<SidebarMenuItem>
									{renderPendingDownloadsIndicator()(() => !props.expanded)}
								</SidebarMenuItem>
							)}
						</Show>
						<NavigationItem
							expanded={props.expanded}
							icon={Tag}
							label={t("sidebar.danbooru")}
							onClick={props.onNavigate}
							to="/danbooru"
						/>
						<NavigationItem
							expanded={props.expanded}
							icon={Palette}
							label={t("sidebar.pixiv")}
							onClick={props.onNavigate}
							to="/pixiv"
						/>
					</SidebarMenu>
				</nav>

				<SourceList
					expanded={props.expanded}
					mediaSources={props.mediaSources}
					onAddSource={props.onAddSource}
					onDeleteSource={props.onDeleteSource}
					onEditSource={props.onEditSource}
					onExpandSidebar={props.onCollapseToggle}
					onNavigate={props.onNavigate}
					onSyncSource={props.onSyncSource}
				/>

				<nav aria-label={t("sidebar.managementNavigation")}>
					<SidebarMenu>
						<For each={NAVIGATION_ITEMS.slice(1)}>
							{(item) => {
								const isJobs = item.to === "/jobs";
								const activeCount = () =>
									isJobs ? (props.jobsCounts?.active ?? 0) : 0;
								const failedCount = () =>
									isJobs ? (props.jobsCounts?.failed ?? 0) : 0;
								const hasJobsBadge = () =>
									activeCount() > 0 || failedCount() > 0;
								return (
									<NavigationItem
										accessibleLabel={
											isJobs
												? getJobsAccessibleLabel(props.jobsCounts)
												: undefined
										}
										badge={
											<Show when={hasJobsBadge()}>
												<span class="flex shrink-0 items-center gap-1">
													<Show when={activeCount() > 0}>
														<span
															aria-hidden="true"
															class="rounded-full bg-accent px-1.5 py-0.5 font-medium text-label-xs text-primary tabular-nums"
														>
															{formatBadgeCount(activeCount())}
														</span>
													</Show>
													<Show when={failedCount() > 0}>
														<span
															aria-hidden="true"
															class="rounded-full bg-error px-1.5 py-0.5 font-medium text-destructive text-label-xs tabular-nums"
														>
															{formatBadgeCount(failedCount())}
														</span>
													</Show>
												</span>
											</Show>
										}
										collapsedBadge={
											<Show when={hasJobsBadge()}>
												<span
													aria-hidden="true"
													class={cn(
														"absolute top-0.5 right-0.5 rounded-full px-1 py-0.5 font-medium text-micro leading-none tabular-nums",
														failedCount() > 0
															? "bg-error text-destructive"
															: "bg-accent text-primary",
													)}
												>
													{formatBadgeCount(
														failedCount() > 0 ? failedCount() : activeCount(),
													)}
												</span>
											</Show>
										}
										expanded={props.expanded}
										icon={item.icon}
										label={t(item.labelKey)}
										onClick={props.onNavigate}
										to={item.to}
									>
										<Show when={item.shortcutId && !hasJobsBadge()}>
											<Show when={item.shortcutId}>
												{(id) => (
													<ShortcutKbd
														class="min-h-5 text-label-xs"
														shortcutId={id()}
													/>
												)}
											</Show>
										</Show>
									</NavigationItem>
								);
							}}
						</For>
					</SidebarMenu>
				</nav>
			</SidebarContent>

			<SidebarSeparator />

			<SidebarFooter>
				<SidebarMenu>
					<Show when={props.serverConnectionsHref}>
						{(href) => (
							<NavigationItem
								expanded={props.expanded}
								icon={Database}
								label={t("servers.serverConnections")}
								onClick={props.onNavigate}
								to={href()}
							/>
						)}
					</Show>
					<NavigationItem
						expanded={props.expanded}
						icon={CircleHelp}
						label={t("sidebar.about")}
						onClick={props.onNavigate}
						to="/about"
					/>
					<Show when={props.apiDocsHref}>
						{(apiDocsHref) => (
							<SidebarMenuItem>
								<SidebarMenuButton
									aria-label={t("sidebar.aPIDocs")}
									as="a"
									class={
										props.expanded
											? "h-11 px-3 font-medium text-muted-foreground md:h-10"
											: "h-11 justify-center px-0 font-medium text-muted-foreground md:h-10"
									}
									href={apiDocsHref()}
									rel="noopener noreferrer"
									target="_blank"
									tooltip={t("sidebar.aPIDocs")}
									tooltipDisabled={props.expanded}
								>
									<FileText aria-hidden="true" class="shrink-0" size={18} />
									<span classList={{ hidden: !props.expanded }}>
										{t("sidebar.aPIDocs")}
									</span>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
					</Show>
				</SidebarMenu>
			</SidebarFooter>
		</Dynamic>
	);
}
