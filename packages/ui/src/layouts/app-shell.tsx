import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { Accessor, JSX, ParentProps } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import type { UseSourcesPageResult } from "../hooks/use-sources-page";
import { createAppShortcut } from "../shortcuts/index";
import { SourceDeleteModal } from "../source-delete-modal";
import { SourceFormModal } from "../source-form-modal";
import { readUiStorageValue, UI_STORAGE_KEYS } from "../ui-storage";
import { CommandCenter } from "./command-center";
import { MobileHeader } from "./mobile-header";
import { Sidebar } from "./sidebar";

export type AppShellProps = ParentProps<{
	apiDocsHref?: string;
	mediaSources: Accessor<SafeMediaSource[]>;
	onNavigate?: (to: "/search" | "/manager" | "/jobs" | "/config") => void;
	renderPendingDownloadsIndicator?: (compact: boolean) => JSX.Element;
	serverConnectionsHref?: string;
	sourcePage: UseSourcesPageResult;
	statusIndicator?: JSX.Element;
}>;

/** Workspace-themed frame used while a client is loading or configuring. */
export function WorkspaceSetupFrame(props: ParentProps) {
	return (
		<div class="workspace-theme flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--workspace-canvas)] text-[var(--workspace-text)]">
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
			if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
		});
	};

	const toggleSidebar = () => setSidebarExpanded((expanded) => !expanded);
	const navigate = () => setMobileMenuOpen(false);

	createAppShortcut(
		"commandPalette",
		() => updateCommandPaletteOpen(!commandPaletteOpen()),
		{ ignoreInputs: false },
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

	const renderWorkspace = () => {
		const sourcePage = props.sourcePage;

		return (
			<div
				class={`workspace-theme grid h-dvh min-h-0 overflow-hidden bg-[var(--workspace-canvas)] text-[var(--workspace-text)] ${
					sidebarExpanded()
						? "md:grid-cols-[216px_minmax(0,1fr)]"
						: "md:grid-cols-[64px_minmax(0,1fr)]"
				}`}
				data-design="workspace"
			>
				<button
					class="sr-only fixed top-2 left-2 z-[80] rounded-md bg-white px-4 py-2 shadow focus:not-sr-only focus:ring-2 focus:ring-[var(--workspace-focus)]"
					onClick={(event) => {
						event.preventDefault();
						const mainContent = document.getElementById("main-content");
						mainContent?.focus({ preventScroll: true });
					}}
					type="button"
				>
					メインコンテンツへ移動
				</button>
				<aside
					aria-label="アプリケーションサイドバー"
					class="hidden min-h-0 border-[var(--workspace-border)] border-r md:block"
				>
					<Sidebar
						apiDocsHref={props.apiDocsHref}
						expanded={sidebarExpanded()}
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
				</aside>

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
						{props.children}
					</main>
				</div>

				<Dialog onOpenChange={setMobileMenuOpen} open={mobileMenuOpen()}>
					<DialogContent
						class="workspace-theme p-0"
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							requestAnimationFrame(() => {
								if (mobileMenuTrigger?.isConnected) {
									mobileMenuTrigger.focus({ preventScroll: true });
								}
							});
						}}
						placement="left"
					>
						<DialogHeader class="sr-only">
							<DialogTitle>ナビゲーション</DialogTitle>
							<DialogDescription>
								画面とメディアソースを選択します。
							</DialogDescription>
						</DialogHeader>
						<Sidebar
							apiDocsHref={props.apiDocsHref}
							expanded
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
					</DialogContent>
				</Dialog>

				<SourceFormModal
					editingSource={sourcePage.editingSource()}
					isOpen={sourcePage.showFormModal()}
					onClose={() => sourcePage.setShowFormModal(false)}
					onSubmit={sourcePage.handleFormSubmit}
				/>
				<SourceDeleteModal
					isOpen={sourcePage.showDeleteModal()}
					onClose={() => sourcePage.setShowDeleteModal(false)}
					onConfirm={sourcePage.handleDeleteConfirm}
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
			</div>
		);
	};

	return renderWorkspace();
}
