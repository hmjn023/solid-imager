import { t } from "@solid-imager/i18n";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import type { Accessor, JSX, ParentProps } from "solid-js";
import {
	createContext,
	createEffect,
	createSignal,
	onCleanup,
	onMount,
	useContext,
} from "solid-js";
import type { UseSourcesPageResult } from "../hooks/use-sources-page";
import { PendingDownloadsProvider } from "../pending-downloads-indicator-core";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../sheet";
import { createAppShortcut } from "../shortcuts/create-app-shortcut";
import { hasOpenDialog } from "../shortcuts/preferences-provider";
import { SidebarProvider } from "../sidebar";
import { SourceDeleteModal } from "../source-delete-modal";
import { SourceFormModal } from "../source-form-modal";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";
import { AddSourceContext } from "../workspace/add-source-context";
import { CommandCenter } from "./command-center";
import { MobileHeader } from "./mobile-header";
import { type JobsBadgeCounts, Sidebar } from "./sidebar";

export type { JobsBadgeCounts } from "./sidebar";

/** Provides live active/failed job counts to the shared workspace sidebar. */
export const JobsBadgeContext =
	createContext<Accessor<JobsBadgeCounts | undefined>>();

export type AppShellProps = ParentProps<{
	apiDocsHref?: string;
	jobsCounts?: Accessor<JobsBadgeCounts | undefined>;
	mediaSources: Accessor<SafeMediaSource[]>;
	onNavigate?: (to: "/search" | "/manager" | "/jobs" | "/config") => void;
	renderPendingDownloadsIndicator?: (compact: Accessor<boolean>) => JSX.Element;
	serverConnectionsHref?: string;
	sourcePage: UseSourcesPageResult;
	statusIndicator?: JSX.Element;
}>;

/** Workspace-themed frame used while a client is loading or configuring. */
export function WorkspaceSetupFrame(props: ParentProps) {
	return (
		<div class="workspace-theme flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
			<main
				class="min-h-0 min-w-0 flex-1 overflow-auto"
				id="main-content"
				tabIndex={-1}
			>
				{props.children}
			</main>
		</div>
	);
}

/**
 * The shared workspace frame used by the web and Tauri clients.
 *
 * Source fetching and mutations stay in each app's adapter. The shell owns the
 * presentation state (sidebar, mobile drawer, command palette, shortcuts, and
 * source dialogs) so the two clients render the same workspace.
 */
export function AppShell(props: AppShellProps) {
	const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
	const [sidebarPreferenceReady, setSidebarPreferenceReady] =
		createSignal(false);
	const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
	const [shortcutHelpOpen, setShortcutHelpOpen] = createSignal(false);
	let mobileMenuTrigger: HTMLButtonElement | undefined;
	let commandPaletteReturnFocus: HTMLElement | null = null;
	let focusRestoreFrame: number | undefined;

	const updateCommandPaletteOpen = (open: boolean) => {
		if (open && !commandPaletteOpen()) {
			commandPaletteReturnFocus =
				document.activeElement instanceof HTMLElement
					? document.activeElement
					: null;
		}
		setCommandPaletteOpen(open);
		if (open || !commandPaletteReturnFocus) return;
		const returnFocus = commandPaletteReturnFocus;
		commandPaletteReturnFocus = null;
		if (focusRestoreFrame !== undefined)
			cancelAnimationFrame(focusRestoreFrame);
		focusRestoreFrame = requestAnimationFrame(() => {
			focusRestoreFrame = undefined;
			if (
				commandPaletteOpen() ||
				shortcutHelpOpen() ||
				props.sourcePage.showFormModal() ||
				props.sourcePage.showDeleteModal() ||
				hasOpenDialog()
			) {
				return;
			}
			if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
		});
	};

	const toggleSidebar = () => setSidebarExpanded((expanded) => !expanded);
	const navigate = () => setMobileMenuOpen(false);

	createAppShortcut(
		"commandPalette",
		() => updateCommandPaletteOpen(!commandPaletteOpen()),
		() => ({
			ignoreInputs: false,
			allowWhenSuspended: commandPaletteOpen(),
		}),
	);
	createAppShortcut("shortcutHelp", () => setShortcutHelpOpen(true));
	createAppShortcut("toggleSidebar", toggleSidebar);
	if (props.sourcePage && props.onNavigate) {
		createAppShortcut("goLibrary", () => props.onNavigate?.("/search"));
		createAppShortcut("goManager", () => props.onNavigate?.("/manager"));
		createAppShortcut("goJobs", () => props.onNavigate?.("/jobs"));
		createAppShortcut("goSettings", () => props.onNavigate?.("/config"));
	}

	onMount(() => {
		try {
			const storedPreference = readUiStorageValue(
				localStorage,
				UI_STORAGE_KEYS.sidebarExpanded,
			);
			if (storedPreference === "false") setSidebarExpanded(false);
			if (storedPreference === "true") setSidebarExpanded(true);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
		setSidebarPreferenceReady(true);
	});
	onCleanup(() => {
		if (focusRestoreFrame !== undefined)
			cancelAnimationFrame(focusRestoreFrame);
	});
	createEffect(() => {
		if (!sidebarPreferenceReady()) return;
		try {
			localStorage.setItem(
				UI_STORAGE_KEYS.sidebarExpanded,
				String(sidebarExpanded()),
			);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	});

	const inheritedJobsCounts = useContext(JobsBadgeContext);
	const resolvedJobsCounts = () =>
		props.jobsCounts?.() ?? inheritedJobsCounts?.();

	const renderWorkspace = () => {
		const sourcePage = props.sourcePage;

		return (
			<PendingDownloadsProvider>
				<SidebarProvider
					class={`workspace-theme grid h-dvh min-h-0 overflow-hidden bg-background text-foreground ${
						sidebarExpanded()
							? "md:grid-cols-app-sidebar"
							: "md:grid-cols-app-sidebar-collapsed"
					}`}
					data-design="workspace"
					enableKeyboardShortcut={false}
					onOpenChange={setSidebarExpanded}
					open={sidebarExpanded()}
				>
					<button
						class="sr-only rounded-md border border-border bg-popover text-popover-foreground shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-app-overlay focus:px-4 focus:py-2 focus:ring-2 focus:ring-ring"
						onClick={(event) => {
							event.preventDefault();
							const mainContent = document.getElementById("main-content");
							mainContent?.focus({ preventScroll: true });
						}}
						type="button"
					>
						{t("appShell.skipToMainContent")}
					</button>
					<Sidebar
						apiDocsHref={props.apiDocsHref}
						aria-label={t("appShell.applicationSidebar")}
						as="aside"
						class="hidden border-border border-r md:flex"
						expanded={sidebarExpanded()}
						jobsCounts={resolvedJobsCounts()}
						mediaSources={props.mediaSources()}
						onAddSource={sourcePage.handleAddSource}
						onCollapseToggle={toggleSidebar}
						onDeleteSource={sourcePage.handleDeleteSource}
						onEditSource={sourcePage.handleEditSource}
						onNavigate={navigate}
						onOpenCommandPalette={() => updateCommandPaletteOpen(true)}
						onSyncSource={(source) => void sourcePage.handleSyncSource(source)}
						renderPendingDownloadsIndicator={
							props.renderPendingDownloadsIndicator
						}
						serverConnectionsHref={props.serverConnectionsHref}
					/>

					<div class="flex min-h-0 min-w-0 flex-col">
						<MobileHeader
							onOpenCommandPalette={() => updateCommandPaletteOpen(true)}
							onOpenMenu={() => setMobileMenuOpen(true)}
							renderPendingDownloadsIndicator={
								props.renderPendingDownloadsIndicator
							}
							triggerRef={(element) => {
								mobileMenuTrigger = element;
							}}
						/>
						{props.statusIndicator}
						<main
							class="min-h-0 min-w-0 flex-1 overflow-hidden"
							id="main-content"
							tabIndex={-1}
						>
							<AddSourceContext.Provider value={sourcePage.handleAddSource}>
								{props.children}
							</AddSourceContext.Provider>
						</main>
					</div>

					<Sheet onOpenChange={setMobileMenuOpen} open={mobileMenuOpen()}>
						<SheetContent
							class="workspace-theme overflow-hidden p-0"
							onCloseAutoFocus={(event) => {
								event.preventDefault();
								requestAnimationFrame(() => {
									if (mobileMenuTrigger?.isConnected) {
										mobileMenuTrigger.focus({ preventScroll: true });
									}
								});
							}}
							position="left"
						>
							<SheetHeader class="sr-only">
								<SheetTitle>{t("appShell.navigation")}</SheetTitle>
								<SheetDescription>
									{t("appShell.chooseAScreenAndMediaSource")}
								</SheetDescription>
							</SheetHeader>
							<Sidebar
								apiDocsHref={props.apiDocsHref}
								expanded
								inDrawer
								jobsCounts={resolvedJobsCounts()}
								mediaSources={props.mediaSources()}
								onAddSource={sourcePage.handleAddSource}
								onCollapseToggle={undefined}
								onDeleteSource={sourcePage.handleDeleteSource}
								onEditSource={sourcePage.handleEditSource}
								onNavigate={navigate}
								onOpenCommandPalette={() => updateCommandPaletteOpen(true)}
								onSyncSource={(source) =>
									void sourcePage.handleSyncSource(source)
								}
								renderPendingDownloadsIndicator={
									props.renderPendingDownloadsIndicator
								}
								serverConnectionsHref={props.serverConnectionsHref}
							/>
						</SheetContent>
					</Sheet>

					<SourceFormModal
						editingSource={sourcePage.editingSource()}
						isOpen={sourcePage.showFormModal()}
						onClose={() => sourcePage.setShowFormModal(false)}
						onSubmit={sourcePage.handleFormSubmit}
					/>
					<SourceDeleteModal
						isDeleting={sourcePage.isDeleting()}
						isOpen={sourcePage.showDeleteModal()}
						onClose={() => sourcePage.setShowDeleteModal(false)}
						onConfirm={(event) => {
							void sourcePage.handleDeleteConfirm(event);
						}}
						sourceToDelete={sourcePage.deletingSource()}
					/>
					<CommandCenter
						helpOpen={shortcutHelpOpen()}
						onAddSource={sourcePage.handleAddSource}
						onHelpOpenChange={setShortcutHelpOpen}
						onPaletteOpenChange={updateCommandPaletteOpen}
						onToggleSidebar={toggleSidebar}
						paletteOpen={commandPaletteOpen()}
					/>
				</SidebarProvider>
			</PendingDownloadsProvider>
		);
	};

	return renderWorkspace();
}
