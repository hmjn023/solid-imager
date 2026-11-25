import { getLocale, t } from "@solid-imager/i18n";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import { Link, useLocation } from "@tanstack/solid-router";
import { createSelector, createSignal, For, Show } from "solid-js";
import { Button } from "../button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../dropdown-menu";
import { TooltipContent, TooltipTrigger } from "../tooltip";
import { cn } from "../utils/cn";
import {
	ChevronDown,
	Database,
	Ellipsis,
	Plus,
	RefreshCw,
} from "../workspace/icons";
import { SidebarTooltip } from "./sidebar-tooltip";

export type SourceListProps = {
	expanded: boolean;
	mediaSources: SafeMediaSource[];
	onAddSource: () => void;
	onDeleteSource: (source: SafeMediaSource) => void;
	onEditSource: (source: SafeMediaSource) => void;
	onExpandSidebar?: () => void;
	onNavigate?: () => void;
	onSyncSource: (source: SafeMediaSource) => void;
};

function sourceTypeLabel(source: SafeMediaSource): string {
	return source.type === "local"
		? t("labels.local")
		: source.type.toUpperCase();
}

const syncDateFormatOptions = {
	dateStyle: "short",
	timeStyle: "short",
} as const;
const syncDateFormatters = {
	ja: new Intl.DateTimeFormat("ja", syncDateFormatOptions),
	en: new Intl.DateTimeFormat("en", syncDateFormatOptions),
};

function sourceSyncDetail(source: SafeMediaSource): string {
	if (source.syncStatus === "syncing") return t("sourceList.syncing");
	if (source.syncStatus === "error") {
		return source.lastSyncError
			? t("useManagerPage.errorValue", { value0: String(source.lastSyncError) })
			: t("sourceList.syncError");
	}
	if (source.lastSyncCompletedAt) {
		return t("sourceList.lastSyncValue", {
			value0: syncDateFormatters[getLocale()].format(
				source.lastSyncCompletedAt,
			),
		});
	}
	return t("sourceList.notSynced");
}

function SourceActions(props: {
	onDelete: () => void;
	onEdit: () => void;
	onSync: () => void;
	isSyncing: boolean;
	sourceName: string;
}) {
	return (
		<DropdownMenu placement="right-start">
			<DropdownMenuTrigger
				aria-label={t("sourceList.actionsForValue", {
					value0: String(props.sourceName),
				})}
				class="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring md:size-7"
			>
				<Ellipsis aria-hidden="true" size={14} />
			</DropdownMenuTrigger>
			<DropdownMenuContent class="w-44 space-y-1 p-1.5">
				<DropdownMenuItem
					class="min-h-11 md:min-h-8"
					disabled={props.isSyncing}
					onSelect={props.onSync}
				>
					<RefreshCw aria-hidden="true" size={14} />
					{props.isSyncing ? t("status.syncing") : t("sourceList.sync")}
				</DropdownMenuItem>
				<DropdownMenuItem class="min-h-11 md:min-h-8" onSelect={props.onEdit}>
					{t("actions.edit")}
				</DropdownMenuItem>
				<DropdownMenuItem
					class="min-h-11 text-destructive focus:bg-destructive/10 focus:text-destructive md:min-h-8"
					onSelect={props.onDelete}
				>
					{t("actions.delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function SourceList(props: SourceListProps) {
	const [sourcesOpen, setSourcesOpen] = createSignal(true);
	const currentSourceId = useLocation({
		select: ({ pathname }) => {
			const match = /^\/sources\/([^/]+)/.exec(pathname);
			return match?.[1] ? decodeURIComponent(match[1]) : undefined;
		},
	});
	const isCurrentSource = createSelector(currentSourceId);
	const handleSourcesOpenChange = (open: boolean) => {
		if (props.expanded) {
			setSourcesOpen(open);
		} else {
			setSourcesOpen(true);
			props.onExpandSidebar?.();
		}
	};

	return (
		<Collapsible
			class="mt-1 min-h-0"
			onOpenChange={handleSourcesOpenChange}
			open={props.expanded && sourcesOpen()}
		>
			<SidebarTooltip disabled={props.expanded}>
				<TooltipTrigger
					aria-label={t("sourceList.sources")}
					as={CollapsibleTrigger}
					class={cn(
						"flex h-11 w-full items-center rounded-md font-medium text-muted-foreground text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:h-10",
						props.expanded ? "gap-2 px-3 text-left" : "justify-center px-0",
					)}
				>
					<Database aria-hidden="true" class="shrink-0" size={18} />
					<span
						class="min-w-0 flex-1 truncate"
						classList={{ hidden: !props.expanded }}
					>
						{t("sourceList.sources")}
					</span>
					<ChevronDown
						aria-hidden="true"
						class="shrink-0 transition-transform motion-reduce:transition-none"
						classList={{ hidden: !props.expanded, "rotate-180": sourcesOpen() }}
						size={14}
					/>
				</TooltipTrigger>
				<TooltipContent>{t("sourceList.sources")}</TooltipContent>
			</SidebarTooltip>
			<CollapsibleContent>
				<div class="ml-4 max-h-menu-source overflow-y-auto overscroll-contain border-border border-l py-1 pl-2 scrollbar-stable">
					<Show
						fallback={
							<p class="px-2 py-3 text-muted-foreground text-xs">
								{t("sourceList.noSourcesYet")}
							</p>
						}
						when={props.mediaSources.length > 0}
					>
						<For each={props.mediaSources}>
							{(source) => (
								<div
									class={`group/source flex min-h-11 items-center rounded-md pr-1 ${
										isCurrentSource(source.id) ? "bg-accent" : "hover:bg-muted"
									}`}
								>
									<Link
										aria-current={
											isCurrentSource(source.id) ? "page" : undefined
										}
										class="min-w-0 flex-1 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={props.onNavigate}
										params={{ mediaSourceId: source.id ?? "" }}
										to="/sources/$mediaSourceId"
									>
										<span class="block truncate font-medium text-foreground text-xs">
											{source.name}
										</span>
										<span class="mt-0.5 block text-label-xs text-muted-foreground">
											{t("sourceList.valueValueValueItems", {
												value0: String(sourceTypeLabel(source)),
												value2: String(
													source.mediaCount?.toLocaleString() ?? "—",
												),
											})}
										</span>
										<span
											class="mt-0.5 block truncate text-label-xs text-muted-foreground"
											title={source.lastSyncError ?? undefined}
										>
											{sourceSyncDetail(source)}
										</span>
									</Link>
									<SourceActions
										onDelete={() => props.onDeleteSource(source)}
										onEdit={() => props.onEditSource(source)}
										onSync={() => props.onSyncSource(source)}
										isSyncing={source.syncStatus === "syncing"}
										sourceName={source.name}
									/>
								</div>
							)}
						</For>
					</Show>
				</div>
				<Button
					class="mt-1 h-11 w-full justify-start px-6 text-xs md:h-8"
					onClick={props.onAddSource}
					size="sm"
					variant="ghost"
				>
					<Plus aria-hidden="true" size={14} />
					{t("actions.addSource")}
				</Button>
			</CollapsibleContent>
		</Collapsible>
	);
}
