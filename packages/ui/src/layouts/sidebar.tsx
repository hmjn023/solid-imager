import { t } from "@solid-imager/i18n";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { Button } from "../button";
import { ShortcutKbd } from "../shortcuts/shortcut-kbd";
import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "../sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../tooltip";
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
import { SourceList } from "./source-list";

export type SidebarProps = {
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
	renderPendingDownloadsIndicator?: (
		compact: boolean,
	) => import("solid-js").JSX.Element;
};

export function Sidebar(props: SidebarProps) {
	return (
		<div class="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-background text-foreground scrollbar-stable *:shrink-0">
			<SidebarHeader>
				<div
					class={
						props.expanded
							? "group flex h-12 items-center gap-2 px-2"
							: "group flex flex-col items-center gap-1.5 py-1"
					}
				>
					<Show
						fallback={
							<Tooltip placement="right">
								<TooltipTrigger
									aria-label={t("sidebar.solidImagerLibrary")}
									as={Link}
									class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
									onClick={props.onNavigate}
									to="/search"
								>
									<Image aria-hidden="true" size={17} />
								</TooltipTrigger>
								<TooltipContent>
									{t("sidebar.solidImagerLibrary")}
								</TooltipContent>
							</Tooltip>
						}
						when={props.expanded}
					>
						<Link
							aria-label={t("sidebar.solidImagerLibrary")}
							class="flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
							onClick={props.onNavigate}
							to="/search"
						>
							<span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
								<Image aria-hidden="true" size={17} />
							</span>
							<strong class="min-w-0 flex-1 truncate font-semibold text-base text-foreground">
								{t("sidebar.solidImager")}
							</strong>
						</Link>
					</Show>
					<Show when={props.onCollapseToggle}>
						{(onCollapseToggle) => (
							<Show
								fallback={
									<Tooltip placement="right">
										<TooltipTrigger
											aria-label={t("sidebar.expandSidebar")}
											as={Button}
											class="size-11 shrink-0 p-0 text-muted-foreground md:size-8"
											onClick={onCollapseToggle()}
											size="icon"
											variant="ghost"
										>
											<PanelLeftOpen aria-hidden="true" size={17} />
										</TooltipTrigger>
										<TooltipContent>
											{t("sidebar.expandSidebar")}
										</TooltipContent>
									</Tooltip>
								}
								when={props.expanded}
							>
								<Button
									aria-label={t("sidebar.collapseSidebar")}
									class="size-11 shrink-0 p-0 text-muted-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 md:size-8"
									onClick={onCollapseToggle()}
									size="icon"
									variant="ghost"
								>
									<PanelLeftClose aria-hidden="true" size={17} />
								</Button>
							</Show>
						)}
					</Show>
				</div>

				<Show when={props.onOpenCommandPalette}>
					{(onOpenCommandPalette) => (
						<Show
							fallback={
								<Tooltip placement="right">
									<TooltipTrigger
										aria-label={t("sidebar.quickActions")}
										as={Button}
										class="h-10 w-full justify-center border border-border bg-card px-0 text-muted-foreground shadow-none hover:bg-muted"
										onClick={onOpenCommandPalette()}
										variant="outline"
									>
										<Search aria-hidden="true" class="shrink-0" size={16} />
									</TooltipTrigger>
									<TooltipContent>{t("sidebar.quickActions")}</TooltipContent>
								</Tooltip>
							}
							when={props.expanded}
						>
							<Button
								aria-label={t("sidebar.quickActions")}
								class="h-10 w-full justify-start gap-2 border border-border bg-card px-3 text-muted-foreground shadow-none hover:bg-muted"
								onClick={onOpenCommandPalette()}
								variant="outline"
							>
								<Search aria-hidden="true" class="shrink-0" size={16} />
								<span class="min-w-0 flex-1 truncate text-left">
									{t("sidebar.quickActions")}
								</span>
								<ShortcutKbd
									class="min-h-5 text-label-xs"
									shortcutId="commandPalette"
								/>
							</Button>
						</Show>
					)}
				</Show>
			</SidebarHeader>

			<SidebarContent class="min-h-fit shrink-0 gap-1 overflow-visible">
				<SidebarGroup class="px-2 py-0">
					<SidebarGroupLabel aria-hidden="true" class="sr-only">
						{t("sidebar.primaryNavigation")}
					</SidebarGroupLabel>
					<SidebarGroupContent>
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
											{renderPendingDownloadsIndicator()(!props.expanded)}
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
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup class="px-2 py-0">
					<SidebarGroupContent>
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
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup class="px-2 py-0">
					<SidebarGroupLabel aria-hidden="true" class="sr-only">
						{t("sidebar.managementNavigation")}
					</SidebarGroupLabel>
					<SidebarGroupContent>
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
					</SidebarGroupContent>
				</SidebarGroup>
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
									tooltip={props.expanded ? undefined : t("sidebar.aPIDocs")}
								>
									<FileText aria-hidden="true" class="shrink-0" size={18} />
									<Show when={props.expanded}>
										<span>{t("sidebar.aPIDocs")}</span>
									</Show>
								</SidebarMenuButton>
							</SidebarMenuItem>
						)}
					</Show>
				</SidebarMenu>
			</SidebarFooter>
		</div>
	);
}
