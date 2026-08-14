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
import { SourceDeleteModal } from "@solid-imager/ui/source-delete-modal";
import { V2SourceFormModal } from "@solid-imager/ui/v2-source-form-modal";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import type { JSX, ParentProps } from "solid-js";
import { createSignal } from "solid-js";
import { createServerTransport } from "~/hooks/use-media-source-events";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { V2MobileHeader } from "./v2-mobile-header";
import { V2Sidebar, type V2SidebarProps } from "./v2-sidebar";

type V2AppShellProps = ParentProps<{
	statusIndicator?: JSX.Element;
}>;

export function V2AppShell(props: V2AppShellProps) {
	const queryClient = useQueryClient();
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
				<V2MobileHeader onOpenMenu={() => setMobileMenuOpen(true)} />
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
						onCollapseToggle={undefined}
						onNavigate={() => setMobileMenuOpen(false)}
					/>
				</DialogContent>
			</Dialog>

			<V2SourceFormModal
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
		</div>
	);
}
