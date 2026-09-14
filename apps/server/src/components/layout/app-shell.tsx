import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import type { RawEventHandler } from "@solid-imager/ui/hooks/use-sources-events";
import { useSourcesPage } from "@solid-imager/ui/hooks/use-sources-page";
import { createAppShortcut } from "@solid-imager/ui/shortcuts/index";
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { SourceFormModal } from "@solid-imager/ui/source-form-modal";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import type { JSX, ParentProps } from "solid-js";
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { CommandCenter } from "./command-center";
import { MobileHeader } from "./mobile-header";
import { Sidebar, type SidebarProps } from "./sidebar";

type AppShellProps = ParentProps<{
	statusIndicator?: JSX.Element;
}>;

// Keep the historical key so existing sidebar preferences survive the rename.
const SIDEBAR_PREFERENCE_KEY = "solid-imager:v2-sidebar-expanded";

export function AppShell(props: AppShellProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const mediaSources = createQuery(mediaSourcesQueryOptions);
	const sourceEventTransport = createServerTransport(() => "*", {
		onResumeFromIdle: () => {
			void queryClient.refetchQueries({
				queryKey: mediaSourcesQueryOptions().queryKey,
			});
		},
	});
	const registerSourceEvents = (handler: RawEventHandler) =>
		sourceEventTransport.listen(handler);
	const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
	const [sidebarPreferenceReady, setSidebarPreferenceReady] =
		createSignal(false);
	const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
	const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
	const [shortcutHelpOpen, setShortcutHelpOpen] = createSignal(false);
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
		if (focusRestoreFrame !== undefined) {
			cancelAnimationFrame(focusRestoreFrame);
		}
		focusRestoreFrame = requestAnimationFrame(() => {
			focusRestoreFrame = undefined;
			if (returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
		});
	};
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
	const sidebarProps = (): SidebarProps => ({
		expanded: sidebarExpanded(),
		mediaSources: sourceData(),
		onAddSource: sourcePage.handleAddSource,
		onCollapseToggle: () => setSidebarExpanded((expanded) => !expanded),
		onDeleteSource: sourcePage.handleDeleteSource,
		onEditSource: sourcePage.handleEditSource,
		onOpenCommandPalette: () => updateCommandPaletteOpen(true),
		onSyncSource: (source) => void sourcePage.handleSyncSource(source),
	});
	createAppShortcut(
		"commandPalette",
		() => updateCommandPaletteOpen(!commandPaletteOpen()),
		{ ignoreInputs: false },
	);
	createAppShortcut("shortcutHelp", () => setShortcutHelpOpen(true));
	createAppShortcut("toggleSidebar", () =>
		setSidebarExpanded((expanded) => !expanded),
	);
	createAppShortcut("goLibrary", () => {
		void navigate({ to: "/search" });
	});
	createAppShortcut("goManager", () => {
		void navigate({ to: "/manager" });
	});
	createAppShortcut("goJobs", () => {
		void navigate({ to: "/jobs" });
	});
	createAppShortcut("goSettings", () => {
		void navigate({ to: "/config" });
	});
	onMount(() => {
		const storedPreference = localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
		if (storedPreference === "false") setSidebarExpanded(false);
		if (storedPreference === "true") setSidebarExpanded(true);
		setSidebarPreferenceReady(true);
	});
	onCleanup(() => {
		if (focusRestoreFrame !== undefined) {
			cancelAnimationFrame(focusRestoreFrame);
		}
	});
	createEffect(() => {
		if (!sidebarPreferenceReady()) return;
		localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(sidebarExpanded()));
	});

	return (
		<div
			class={`workspace-theme grid h-dvh min-h-0 overflow-hidden bg-[var(--workspace-canvas)] text-[var(--workspace-text)] ${
				sidebarExpanded()
					? "md:grid-cols-[216px_minmax(0,1fr)]"
					: "md:grid-cols-[64px_minmax(0,1fr)]"
			}`}
			data-design="workspace"
		>
			<a
				class="sr-only fixed top-2 left-2 z-[80] rounded-md bg-white px-4 py-2 shadow focus:not-sr-only focus:ring-2 focus:ring-[var(--workspace-focus)]"
				href="#main-content"
			>
				メインコンテンツへ移動
			</a>
			<aside
				aria-label="アプリケーションサイドバー"
				class="hidden min-h-0 border-[var(--workspace-border)] border-r md:block"
			>
				<Sidebar {...sidebarProps()} />
			</aside>

			<div class="flex min-h-0 min-w-0 flex-col">
				<MobileHeader
					onOpenCommandPalette={() => updateCommandPaletteOpen(true)}
					onOpenMenu={() => setMobileMenuOpen(true)}
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
				<DialogContent class="workspace-theme p-0" placement="left">
					<DialogHeader class="sr-only">
						<DialogTitle>ナビゲーション</DialogTitle>
						<DialogDescription>
							画面とメディアソースを選択します。
						</DialogDescription>
					</DialogHeader>
					<Sidebar
						{...sidebarProps()}
						expanded
						onCollapseToggle={undefined}
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
				onToggleSidebar={() => setSidebarExpanded((expanded) => !expanded)}
				paletteOpen={commandPaletteOpen()}
			/>
		</div>
	);
}
