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

export type SidebarProps = {
	"aria-label"?: string;
	as?: "aside" | "div";
	class?: string;
	apiDocsHref?: string;
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

export function Sidebar(props: SidebarProps) {
	return (
		<Dynamic
			aria-label={props["aria-label"]}
			class={cn(
				"flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-background text-foreground scrollbar-stable *:shrink-0",
				props.class,
			)}
			component={props.as ?? "div"}
			data-state={props.expanded ? "expanded" : "collapsed"}
		>
			<SidebarHeader>
				<div
					class={
						props.expanded
							? "group flex h-12 items-center gap-2 px-2"
							: "group flex flex-col items-center gap-1.5 py-1"
					}
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
											"opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100",
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
							{(item) => (
								<NavigationItem
									expanded={props.expanded}
									icon={item.icon}
									label={t(item.labelKey)}
									onClick={props.onNavigate}
									to={item.to}
								>
									<Show when={item.shortcutId}>
										{(id) => (
											<ShortcutKbd
												class="min-h-5 text-label-xs"
												shortcutId={id()}
											/>
										)}
									</Show>
								</NavigationItem>
							)}
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
