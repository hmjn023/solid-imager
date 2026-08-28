import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import { ShortcutKbd } from "@solid-imager/ui/shortcuts/index";
import {
	CircleHelp,
	FileText,
	Image,
	PanelLeftClose,
	PanelLeftOpen,
	Search,
} from "@solid-imager/ui/v2/icons";
import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { V2PendingDownloadsIndicator } from "~/components/imports/v2-pending-downloads-indicator";
import { V2_NAVIGATION_ITEMS, V2NavigationItem } from "./v2-navigation";
import { V2SourceList } from "./v2-source-list";

export type V2SidebarProps = {
	expanded: boolean;
	mediaSources: SafeMediaSource[];
	onAddSource: () => void;
	onCollapseToggle?: () => void;
	onDeleteSource: (source: SafeMediaSource) => void;
	onEditSource: (source: SafeMediaSource) => void;
	onNavigate?: () => void;
	onOpenCommandPalette?: () => void;
	onSyncSource: (source: SafeMediaSource) => void;
};

export function V2Sidebar(props: V2SidebarProps) {
	return (
		<div class="flex min-h-0 h-full flex-col overflow-y-auto overscroll-contain bg-[var(--v2-surface-subtle)] p-2 [scrollbar-gutter:stable]">
			<div class="group mb-3 flex h-12 items-center gap-2 px-2">
				<Link
					aria-label="Solid Imager Library"
					class="flex min-w-0 flex-1 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
					onClick={props.onNavigate}
					to="/v2/search"
				>
					<span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--v2-primary)] text-white">
						<Image aria-hidden="true" size={17} />
					</span>
					<Show when={props.expanded}>
						<strong class="min-w-0 flex-1 truncate font-semibold text-base text-[var(--v2-text)]">
							Solid Imager
						</strong>
					</Show>
				</Link>
				<Show when={props.onCollapseToggle}>
					{(onCollapseToggle) => (
						<Button
							aria-label={
								props.expanded
									? "サイドバーを折りたたむ"
									: "サイドバーを展開する"
							}
							class={`size-11 shrink-0 p-0 text-[var(--v2-text-muted)] md:size-8 ${
								props.expanded
									? "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
									: "opacity-100"
							}`}
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
						</Button>
					)}
				</Show>
			</div>

			<Show when={props.onOpenCommandPalette}>
				{(onOpenCommandPalette) => (
					<Button
						aria-label="Quick actions"
						class="mb-2 h-10 w-full justify-start gap-2 border border-[var(--v2-border)] bg-[var(--v2-surface)] px-3 text-[var(--v2-text-secondary)] shadow-none hover:bg-[var(--v2-surface-muted)]"
						onClick={onOpenCommandPalette()}
						title="Quick actions"
						variant="outline"
					>
						<Search aria-hidden="true" class="shrink-0" size={16} />
						<Show when={props.expanded}>
							<span class="min-w-0 flex-1 truncate text-left">
								Quick actions
							</span>
							<ShortcutKbd
								class="min-h-5 text-[10px]"
								shortcutId="commandPalette"
							/>
						</Show>
					</Button>
				)}
			</Show>

			<nav aria-label="主要ナビゲーション" class="space-y-1">
				<V2NavigationItem
					expanded={props.expanded}
					icon={V2_NAVIGATION_ITEMS[0].icon}
					label={V2_NAVIGATION_ITEMS[0].label}
					onClick={props.onNavigate}
					to={V2_NAVIGATION_ITEMS[0].to}
				>
					<ShortcutKbd
						class="min-h-5 text-[10px]"
						shortcutId={V2_NAVIGATION_ITEMS[0].shortcutId}
					/>
				</V2NavigationItem>
				<V2PendingDownloadsIndicator compact={!props.expanded} />
			</nav>

			<V2SourceList
				expanded={props.expanded}
				mediaSources={props.mediaSources}
				onAddSource={props.onAddSource}
				onDeleteSource={props.onDeleteSource}
				onEditSource={props.onEditSource}
				onExpandSidebar={props.onCollapseToggle}
				onNavigate={props.onNavigate}
				onSyncSource={props.onSyncSource}
			/>

			<nav aria-label="管理ナビゲーション" class="mt-1 space-y-1">
				<For each={V2_NAVIGATION_ITEMS.slice(1)}>
					{(item) => (
						<V2NavigationItem
							expanded={props.expanded}
							icon={item.icon}
							label={item.label}
							onClick={props.onNavigate}
							to={item.to}
						>
							<ShortcutKbd
								class="min-h-5 text-[10px]"
								shortcutId={item.shortcutId}
							/>
						</V2NavigationItem>
					)}
				</For>
			</nav>

			<div class="mt-auto border-[var(--v2-border)] border-t pt-2">
				<V2NavigationItem
					expanded={props.expanded}
					icon={CircleHelp}
					label="About"
					onClick={props.onNavigate}
					to="/v2/about"
				/>
				<a
					aria-label="API Docs"
					class="flex h-11 items-center gap-2 rounded-md px-3 font-medium text-sm text-[var(--v2-text-muted)] outline-none hover:bg-[var(--v2-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10"
					href="/docs/swagger"
					rel="noopener noreferrer"
					target="_blank"
				>
					<FileText aria-hidden="true" class="shrink-0" size={18} />
					<Show when={props.expanded}>
						<span>API Docs</span>
					</Show>
				</a>
			</div>
		</div>
	);
}
