import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
	CollapsibleContent,
	CollapsibleRoot,
	CollapsibleTrigger,
} from "@solid-imager/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@solid-imager/ui/popover";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import {
	BriefcaseBusiness,
	ChevronDown,
	CircleHelp,
	Clock3,
	Database,
	Ellipsis,
	FileText,
	Image,
	Library,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	Plus,
	RefreshCw,
	Search,
	Settings,
} from "@solid-imager/ui/v2/icons";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX, ParentProps } from "solid-js";
import { createSignal, For, Show } from "solid-js";
import { PendingDownloadsIndicator } from "~/components/imports/pending-downloads-indicator";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

type V2AppShellProps = ParentProps<{
	statusIndicator?: JSX.Element;
}>;

type V2SidebarProps = {
	expanded: boolean;
	mediaSources: SafeMediaSource[];
	onAddSource: () => void;
	onCollapseToggle: () => void;
	onDeleteSource: (source: SafeMediaSource) => void;
	onEditSource: (source: SafeMediaSource) => void;
	onNavigate?: () => void;
	onSyncSource: (source: SafeMediaSource) => void;
};

const V2_NAVIGATION_ITEMS = [
	{ icon: Search, label: "Search", to: "/v2/search" },
	{ icon: BriefcaseBusiness, label: "Manager", to: "/v2/manager" },
	{ icon: Clock3, label: "Jobs", to: "/v2/jobs" },
	{ icon: Settings, label: "Settings", to: "/v2/config" },
] as const;

function sourceTypeLabel(source: SafeMediaSource): string {
	return source.type === "local" ? "Local" : source.type.toUpperCase();
}

function V2NavigationItem(props: {
	children?: JSX.Element;
	expanded: boolean;
	icon: typeof Library;
	label: string;
	onClick?: () => void;
	to: string;
}) {
	const location = useLocation();
	const active = () =>
		location().pathname === props.to ||
		(props.to !== "/v2/search" &&
			location().pathname.startsWith(`${props.to}/`));
	const Icon = props.icon;

	return (
		<Link
			aria-current={active() ? "page" : undefined}
			aria-label={props.label}
			class={`flex h-11 w-full items-center gap-2 rounded-md px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10 ${
				active()
					? "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
					: "text-[var(--v2-text-secondary)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text)]"
			}`}
			onClick={props.onClick}
			to={props.to}
		>
			<Icon aria-hidden="true" class="shrink-0" size={18} />
			<Show when={props.expanded}>
				<span class="min-w-0 flex-1 truncate">{props.label}</span>
				{props.children}
			</Show>
		</Link>
	);
}

function V2SourceActions(props: {
	onDelete: () => void;
	onEdit: () => void;
	onSync: () => void;
	sourceName: string;
}) {
	return (
		<Popover placement="right-start">
			<PopoverTrigger
				aria-label={`${props.sourceName}の操作`}
				class="flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--v2-text-muted)] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:size-7"
			>
				<Ellipsis aria-hidden="true" size={14} />
			</PopoverTrigger>
			<PopoverContent class="w-44 space-y-1 p-1.5">
				<Button
					class="h-11 w-full justify-start px-2 md:h-8"
					onClick={props.onSync}
					size="sm"
					variant="ghost"
				>
					<RefreshCw aria-hidden="true" size={14} />
					Sync
				</Button>
				<Button
					class="h-11 w-full justify-start px-2 md:h-8"
					onClick={props.onEdit}
					size="sm"
					variant="ghost"
				>
					Edit
				</Button>
				<Button
					class="h-11 w-full justify-start px-2 text-destructive md:h-8"
					onClick={props.onDelete}
					size="sm"
					variant="ghost"
				>
					Delete
				</Button>
			</PopoverContent>
		</Popover>
	);
}

function V2Sidebar(props: V2SidebarProps) {
	const location = useLocation();
	const [sourcesOpen, setSourcesOpen] = createSignal(true);
	const currentSourceId = () => {
		const match = /^\/v2\/sources\/([^/]+)/.exec(location().pathname);
		return match?.[1] ? decodeURIComponent(match[1]) : undefined;
	};

	return (
		<div class="flex min-h-0 h-full flex-col bg-[var(--v2-surface-subtle)] p-2">
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
				<Button
					aria-label={
						props.expanded ? "サイドバーを折りたたむ" : "サイドバーを展開する"
					}
					class={`size-11 shrink-0 p-0 text-[var(--v2-text-muted)] md:size-8 ${
						props.expanded
							? "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
							: "opacity-100"
					}`}
					onClick={props.onCollapseToggle}
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
			</div>

			<nav aria-label="主要ナビゲーション" class="space-y-1">
				<V2NavigationItem
					expanded={props.expanded}
					icon={Library}
					label="Library"
					onClick={props.onNavigate}
					to="/v2/search"
				/>
				<div class={props.expanded ? "block" : "hidden"}>
					<PendingDownloadsIndicator variant="v2" />
				</div>
			</nav>

			<CollapsibleRoot.Root
				class="mt-1 min-h-0"
				onOpenChange={setSourcesOpen}
				open={sourcesOpen()}
			>
				<CollapsibleTrigger
					aria-label="Sources"
					class="flex h-11 w-full items-center gap-2 rounded-md px-3 text-left font-medium text-sm text-[var(--v2-text-secondary)] outline-none hover:bg-[var(--v2-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10"
					onClick={() => {
						if (!props.expanded) props.onCollapseToggle();
					}}
				>
					<Database aria-hidden="true" class="shrink-0" size={18} />
					<Show when={props.expanded}>
						<span class="min-w-0 flex-1 truncate">Sources</span>
						<ChevronDown
							aria-hidden="true"
							class={`shrink-0 transition-transform motion-reduce:transition-none ${sourcesOpen() ? "rotate-180" : ""}`}
							size={14}
						/>
					</Show>
				</CollapsibleTrigger>
				<Show when={props.expanded}>
					<CollapsibleContent>
						<div class="ml-4 max-h-[min(36dvh,22rem)] overflow-y-auto overscroll-contain border-[var(--v2-border)] border-l py-1 pl-2 [scrollbar-gutter:stable]">
							<Show
								fallback={
									<p class="px-2 py-3 text-xs text-[var(--v2-text-muted)]">
										ソースはまだありません
									</p>
								}
								when={props.mediaSources.length > 0}
							>
								<For each={props.mediaSources}>
									{(source) => (
										<div
											class={`group/source flex min-h-11 items-center rounded-md pr-1 ${
												currentSourceId() === source.id
													? "bg-[var(--v2-surface-selected)]"
													: "hover:bg-[var(--v2-surface-muted)]"
											}`}
										>
											<Link
												aria-current={
													currentSourceId() === source.id ? "page" : undefined
												}
												class="min-w-0 flex-1 rounded-md px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
												onClick={props.onNavigate}
												params={{ mediaSourceId: source.id ?? "" }}
												to="/v2/sources/$mediaSourceId"
											>
												<span class="block truncate font-medium text-xs text-[var(--v2-text)]">
													{source.name}
												</span>
												<span class="mt-0.5 block text-[10px] text-[var(--v2-text-muted)]">
													{sourceTypeLabel(source)} · 件数未取得
												</span>
											</Link>
											<V2SourceActions
												onDelete={() => props.onDeleteSource(source)}
												onEdit={() => props.onEditSource(source)}
												onSync={() => props.onSyncSource(source)}
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
							Add source
						</Button>
					</CollapsibleContent>
				</Show>
			</CollapsibleRoot.Root>

			<nav aria-label="管理ナビゲーション" class="mt-1 space-y-1">
				<For each={V2_NAVIGATION_ITEMS.slice(1)}>
					{(item) => (
						<V2NavigationItem
							expanded={props.expanded}
							icon={item.icon}
							label={item.label}
							onClick={props.onNavigate}
							to={item.to}
						/>
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

export function V2AppShell(props: V2AppShellProps) {
	const queryClient = useQueryClient();
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceEventTransport = createServerTransport(() => "*");
	const registerSourceEvents = (handler: RawEventHandler) =>
		sourceEventTransport.listen(handler);
	const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
	const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
	const sourceData = () => mediaSources.data ?? [];
	const sourcePage = useSourcesPage({
		actions: {
			createMediaSource: (data: unknown) =>
				createMediaSource(mediaSourceInfoSchema.parse(data)),
			updateMediaSource: (id: string, data: unknown) =>
				updateMediaSource(id, mediaSourceInfoSchema.parse(data)),
			deleteMediaSource,
			syncMediaSources,
		},
		queryClient,
		invalidateQueryKey: mediaSourcesQueryOptions().queryKey,
		registerEvents: registerSourceEvents,
		getSourceIds: () =>
			sourceData().flatMap((source) => (source.id ? [source.id] : [])),
	});
	const sidebarProps = (): V2SidebarProps => ({
		expanded: sidebarExpanded(),
		mediaSources: sourceData(),
		onAddSource: sourcePage.handleAddSource,
		onCollapseToggle: () => setSidebarExpanded((expanded) => !expanded),
		onDeleteSource: sourcePage.handleDeleteSource,
		onEditSource: sourcePage.handleEditSource,
		onSyncSource: (source) => void sourcePage.handleSyncSource(source),
	});

	return (
		<div
			class={`v2-theme grid h-dvh min-h-0 overflow-hidden bg-[var(--v2-canvas)] text-[var(--v2-text)] ${
				sidebarExpanded()
					? "md:grid-cols-[216px_minmax(0,1fr)]"
					: "md:grid-cols-[64px_minmax(0,1fr)]"
			}`}
			data-design-version="v2"
		>
			<a
				class="sr-only fixed top-2 left-2 z-[80] rounded-md bg-white px-4 py-2 shadow focus:not-sr-only focus:ring-2 focus:ring-[var(--v2-focus)]"
				href="#v2-main-content"
			>
				メインコンテンツへ移動
			</a>
			<aside
				aria-label="アプリケーションサイドバー"
				class="hidden min-h-0 border-[var(--v2-border)] border-r md:block"
			>
				<V2Sidebar {...sidebarProps()} />
			</aside>

			<div class="flex min-h-0 min-w-0 flex-col">
				<header class="flex h-13 shrink-0 items-center gap-3 border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-3 md:hidden">
					<Button
						aria-label="メニューを開く"
						class="size-10 p-0"
						onClick={() => setMobileMenuOpen(true)}
						size="icon"
						variant="ghost"
					>
						<Menu aria-hidden="true" size={19} />
					</Button>
					<strong class="min-w-0 flex-1 truncate font-semibold">
						Solid Imager
					</strong>
					<PendingDownloadsIndicator compact variant="v2" />
				</header>
				{props.statusIndicator}
				<main
					class="min-h-0 min-w-0 flex-1 overflow-hidden"
					id="v2-main-content"
					tabIndex={-1}
				>
					{props.children}
				</main>
			</div>

			<Dialog onOpenChange={setMobileMenuOpen} open={mobileMenuOpen()}>
				<DialogContent class="v2-theme p-0" placement="left">
					<DialogHeader class="sr-only">
						<DialogTitle>ナビゲーション</DialogTitle>
						<DialogDescription>
							画面とメディアソースを選択します。
						</DialogDescription>
					</DialogHeader>
					<V2Sidebar
						{...sidebarProps()}
						expanded
						onNavigate={() => setMobileMenuOpen(false)}
					/>
				</DialogContent>
			</Dialog>

			<SourceFormModal
				editingSource={
					sourcePage.editingSource() as MediaSourceInfo | SafeMediaSource | null
				}
				isOpen={sourcePage.showFormModal()}
				onClose={() => sourcePage.setShowFormModal(false)}
				onSubmit={sourcePage.handleFormSubmit}
				variant="v2"
			/>
			<SourceDeleteModal
				isOpen={sourcePage.showDeleteModal()}
				onClose={() => sourcePage.setShowDeleteModal(false)}
				onConfirm={sourcePage.handleDeleteConfirm}
				sourceToDelete={sourcePage.deletingSource()}
			/>
		</div>
	);
}
