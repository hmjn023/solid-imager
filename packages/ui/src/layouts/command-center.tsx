import { t } from "@solid-imager/i18n";
import { useNavigate } from "@tanstack/solid-router";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	Show,
} from "solid-js";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "../command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import {
	getShortcutDefinitionsForGroup,
	SHORTCUT_GROUPS,
	shortcutGroupLabel,
	type ShortcutId,
} from "../shortcuts/definitions";
import { ShortcutKbd } from "../shortcuts/shortcut-kbd";
import {
	BriefcaseBusiness,
	ChartColumn,
	CircleHelp,
	Clock3,
	Library,
	PanelLeftClose,
	Plus,
	Settings,
} from "../workspace/icons";

export type CommandCenterProps = {
	helpOpen: boolean;
	onAddSource: () => void;
	onHelpOpenChange: (open: boolean) => void;
	onPaletteOpenChange: (open: boolean) => void;
	onToggleSidebar: () => void;
	paletteOpen: boolean;
};

type PaletteActionGroup = "Navigate" | "Actions";

type PaletteAction = {
	group: PaletteActionGroup;
	icon: Component<{ class?: string; size?: number | string }>;
	id: string;
	keywords: string[];
	label: string;
	run: () => void;
	shortcutId?: ShortcutId;
};

const PALETTE_GROUPS: readonly PaletteActionGroup[] = ["Navigate", "Actions"];

function paletteGroupLabel(group: PaletteActionGroup): string {
	return group === "Actions"
		? t("entityPanel.actions")
		: t("commandCenter.navigateGroup");
}

export function CommandCenter(props: CommandCenterProps) {
	const navigate = useNavigate();
	const [query, setQuery] = createSignal("");
	const actions = createMemo<PaletteAction[]>(() => {
		const libraryLabel = t("navigation.library");
		const managerLabel = t("navigation.manager");
		const statisticsLabel = t("navigation.statistics");
		const jobsLabel = t("navigation.jobs");
		const settingsLabel = t("navigation.settings");
		const addSourceLabel = t("commandCenter.addMediaSource");
		const toggleSidebarLabel = t("definitions.toggleSidebar");
		const keyboardShortcutsLabel = t("configScreen.keyboardShortcuts");

		return [
			{
				group: "Navigate",
				icon: Library,
				id: "library",
				keywords: [libraryLabel, "media", "images", "search", "browse"],
				label: libraryLabel,
				run: () => void navigate({ to: "/search" }),
				shortcutId: "goLibrary",
			},
			{
				group: "Navigate",
				icon: BriefcaseBusiness,
				id: "manager",
				keywords: [
					managerLabel,
					"projects",
					"characters",
					"ips",
					"bulk",
					"organize",
				],
				label: managerLabel,
				run: () => void navigate({ to: "/manager" }),
				shortcutId: "goManager",
			},
			{
				group: "Navigate",
				icon: ChartColumn,
				id: "statistics",
				keywords: [
					statisticsLabel,
					...t("commandCenter.statisticsImportsRankingsLibrary")
						.split(/\s+/)
						.filter(Boolean),
				],
				label: statisticsLabel,
				run: () => void navigate({ to: "/statistics" }),
			},
			{
				group: "Navigate",
				icon: Clock3,
				id: "jobs",
				keywords: [jobsLabel, "background", "activity", "downloads", "queue"],
				label: jobsLabel,
				run: () => void navigate({ to: "/jobs" }),
				shortcutId: "goJobs",
			},
			{
				group: "Navigate",
				icon: Settings,
				id: "settings",
				keywords: [settingsLabel, "preferences", "keyboard", "key", "bindings"],
				label: settingsLabel,
				run: () => void navigate({ to: "/config" }),
				shortcutId: "goSettings",
			},
			{
				group: "Actions",
				icon: Plus,
				id: "add-media-source",
				keywords: [addSourceLabel, "import", "folder", "library"],
				label: addSourceLabel,
				run: () => props.onAddSource(),
			},
			{
				group: "Actions",
				icon: PanelLeftClose,
				id: "toggle-sidebar",
				keywords: [toggleSidebarLabel, "collapse", "expand", "navigation"],
				label: toggleSidebarLabel,
				run: () => props.onToggleSidebar(),
				shortcutId: "toggleSidebar",
			},
			{
				group: "Actions",
				icon: CircleHelp,
				id: "keyboard-shortcuts",
				keywords: [
					keyboardShortcutsLabel,
					"keyboard",
					"keys",
					"help",
					"reference",
				],
				label: keyboardShortcutsLabel,
				run: () => props.onHelpOpenChange(true),
				shortcutId: "shortcutHelp",
			},
		];
	});
	const actionsByGroup = createMemo<
		Record<PaletteActionGroup, PaletteAction[]>
	>(() => ({
		Actions: actions().filter((action) => action.group === "Actions"),
		Navigate: actions().filter((action) => action.group === "Navigate"),
	}));
	let pendingActionFrame: number | undefined;
	onCleanup(() => {
		if (pendingActionFrame !== undefined) {
			cancelAnimationFrame(pendingActionFrame);
		}
	});
	const runAction = (action: PaletteAction) => {
		props.onPaletteOpenChange(false);
		setQuery("");
		if (pendingActionFrame !== undefined) {
			cancelAnimationFrame(pendingActionFrame);
		}
		// Let the palette close before running actions that open a secondary modal.
		pendingActionFrame = requestAnimationFrame(() => {
			pendingActionFrame = undefined;
			action.run();
		});
	};
	const setPaletteOpen = (open: boolean) => {
		if (!open) setQuery("");
		props.onPaletteOpenChange(open);
	};

	createEffect(() => {
		if (!props.paletteOpen) {
			setQuery("");
		}
	});

	return (
		<>
			<CommandDialog
				description={t("commandCenter.searchNavigationAndApplicationActions")}
				loop
				onOpenChange={setPaletteOpen}
				open={props.paletteOpen}
				title={t("sidebar.quickActions")}
			>
				<div class="workspace-theme flex min-h-0 flex-1 flex-col text-popover-foreground">
					<CommandInput
						aria-label={t("commandCenter.searchQuickActions")}
						autofocus
						class="pr-9"
						on:keydown={(event) => {
							// Run before delegated shortcuts and preserve native IME confirmation.
							if (
								event.isComposing ||
								// oxlint-disable-next-line typescript/no-deprecated -- Safari can report IME confirmation only through keyCode 229.
								(event.key === "Enter" && event.keyCode === 229)
							) {
								event.stopPropagation();
							}
						}}
						onValueChange={setQuery}
						placeholder={t("commandCenter.searchActions")}
						value={query()}
					/>
					<CommandList
						class="max-h-menu-small overscroll-contain p-1 scrollbar-stable"
						label={t("sidebar.quickActions")}
					>
						<CommandEmpty class="px-3 py-8 text-muted-foreground">
							{t("commandCenter.noMatchingAction")}
						</CommandEmpty>
						<For each={PALETTE_GROUPS}>
							{(group) => (
								<CommandGroup heading={paletteGroupLabel(group)}>
									<For each={actionsByGroup()[group]}>
										{(action) => {
											const Icon = action.icon;
											return (
												<CommandItem
													class="gap-3"
													keywords={action.keywords}
													onSelect={() => runAction(action)}
													value={action.id}
												>
													<Icon aria-hidden="true" class="shrink-0" size={20} />
													<span class="min-w-0 flex-1 truncate">
														{action.label}
													</span>
													<Show when={action.shortcutId}>
														{(shortcutId) => (
															<CommandShortcut class="shrink-0 tracking-normal">
																<ShortcutKbd shortcutId={shortcutId()} />
															</CommandShortcut>
														)}
													</Show>
												</CommandItem>
											);
										}}
									</For>
								</CommandGroup>
							)}
						</For>
					</CommandList>
				</div>
			</CommandDialog>

			<Dialog onOpenChange={props.onHelpOpenChange} open={props.helpOpen}>
				<DialogContent class="workspace-theme max-w-2xl overflow-hidden p-0">
					<DialogHeader class="border-border border-b px-5 py-4 pr-12">
						<DialogTitle>{t("configScreen.keyboardShortcuts")}</DialogTitle>
						<DialogDescription>
							{t(
								"commandCenter.useTheseCommandsAnywhereTheyApplyCustomizeThemIn",
							)}
						</DialogDescription>
					</DialogHeader>
					<div class="max-h-menu-tall overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-stable">
						<For each={SHORTCUT_GROUPS}>
							{(group) => (
								<section class="pt-5">
									<h3 class="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
										{shortcutGroupLabel(group)}
									</h3>
									<ul class="divide-y divide-border rounded-lg border border-border bg-background">
										<For each={getShortcutDefinitionsForGroup(group)}>
											{(definition) => (
												<li class="flex min-w-0 items-center gap-4 px-3 py-2.5">
													<div class="min-w-0 flex-1">
														<div class="font-medium text-sm">
															{definition.label}
														</div>
														<p class="truncate text-muted-foreground text-xs">
															{definition.description}
														</p>
													</div>
													<ShortcutKbd shortcutId={definition.id} />
												</li>
											)}
										</For>
									</ul>
								</section>
							)}
						</For>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
