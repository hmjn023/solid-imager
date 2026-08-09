import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
	CollapsibleContent,
	CollapsibleRoot,
	CollapsibleTrigger,
} from "@solid-imager/ui/collapsible";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@solid-imager/ui/popover";
import {
	ChevronDown,
	Database,
	Ellipsis,
	Plus,
	RefreshCw,
} from "@solid-imager/ui/v2/icons";
import { Link, useLocation } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

type V2SourceListProps = {
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
	return source.type === "local" ? "Local" : source.type.toUpperCase();
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

export function V2SourceList(props: V2SourceListProps) {
	const location = useLocation();
	const [sourcesOpen, setSourcesOpen] = createSignal(true);
	const currentSourceId = () => {
		const match = /^\/v2\/sources\/([^/]+)/.exec(location().pathname);
		return match?.[1] ? decodeURIComponent(match[1]) : undefined;
	};

	return (
		<CollapsibleRoot.Root
			class="mt-1 min-h-0"
			onOpenChange={setSourcesOpen}
			open={sourcesOpen()}
		>
			<CollapsibleTrigger
				aria-label="Sources"
				class="flex h-11 w-full items-center gap-2 rounded-md px-3 text-left font-medium text-sm text-[var(--v2-text-secondary)] outline-none hover:bg-[var(--v2-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10"
				onClick={() => {
					if (!props.expanded) props.onExpandSidebar?.();
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
	);
}
