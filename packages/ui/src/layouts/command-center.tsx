import { useNavigate } from "@tanstack/solid-router";
import {
	type Component,
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	For,
	Show,
} from "solid-js";
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
	type ShortcutId,
	ShortcutKbd,
} from "../shortcuts/index";
import {
	BriefcaseBusiness,
	CircleHelp,
	Clock3,
	Library,
	PanelLeftClose,
	Plus,
	Search,
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

type PaletteAction = {
	group: "Actions" | "Navigate";
	icon: Component<{ class?: string; size?: number | string }>;
	keywords: string;
	label: string;
	run: () => void;
	shortcutId?: ShortcutId;
};

type PaletteActionGroup = {
	actions: PaletteAction[];
	group: PaletteAction["group"];
	startIndex: number;
};

export function CommandCenter(props: CommandCenterProps) {
	const navigate = useNavigate();
	const listId = createUniqueId();
	const [query, setQuery] = createSignal("");
	const [activeIndex, setActiveIndex] = createSignal(0);
	const actions = createMemo<PaletteAction[]>(() => [
		{
			group: "Navigate",
			icon: Library,
			keywords: "media images search browse",
			label: "Library",
			run: () => void navigate({ to: "/search" }),
			shortcutId: "goLibrary",
		},
		{
			group: "Navigate",
			icon: BriefcaseBusiness,
			keywords: "projects characters ips bulk organize",
			label: "Manager",
			run: () => void navigate({ to: "/manager" }),
			shortcutId: "goManager",
		},
		{
			group: "Navigate",
			icon: Clock3,
			keywords: "background activity downloads queue",
			label: "Jobs",
			run: () => void navigate({ to: "/jobs" }),
			shortcutId: "goJobs",
		},
		{
			group: "Navigate",
			icon: Settings,
			keywords: "preferences keyboard key bindings",
			label: "Settings",
			run: () => void navigate({ to: "/config" }),
			shortcutId: "goSettings",
		},
		{
			group: "Actions",
			icon: Plus,
			keywords: "import folder library",
			label: "Add media source",
			run: props.onAddSource,
		},
		{
			group: "Actions",
			icon: PanelLeftClose,
			keywords: "collapse expand navigation",
			label: "Toggle sidebar",
			run: props.onToggleSidebar,
			shortcutId: "toggleSidebar",
		},
		{
			group: "Actions",
			icon: CircleHelp,
			keywords: "keyboard keys help reference",
			label: "Keyboard shortcuts",
			run: () => props.onHelpOpenChange(true),
			shortcutId: "shortcutHelp",
		},
	]);
	const filteredActions = createMemo(() => {
		const normalizedQuery = query().trim().toLocaleLowerCase();
		if (!normalizedQuery) return actions();
		return actions().filter((action) =>
			`${action.label} ${action.keywords}`
				.toLocaleLowerCase()
				.includes(normalizedQuery),
		);
	});
	const groupedActions = createMemo<PaletteActionGroup[]>(() => {
		const groups: PaletteActionGroup[] = [];
		for (const [index, action] of filteredActions().entries()) {
			const lastGroup = groups[groups.length - 1];
			if (!lastGroup || lastGroup.group !== action.group) {
				groups.push({
					actions: [action],
					group: action.group,
					startIndex: index,
				});
				continue;
			}
			lastGroup.actions.push(action);
		}
		return groups;
	});
	const itemId = (index: number) => `${listId}-option-${index}`;
	const runAction = (action: PaletteAction) => {
		props.onPaletteOpenChange(false);
		setQuery("");
		action.run();
	};
	const setPaletteOpen = (open: boolean) => {
		if (!open) setQuery("");
		props.onPaletteOpenChange(open);
	};
	const moveActive = (nextIndex: number) => {
		const count = filteredActions().length;
		if (count === 0) return;
		setActiveIndex((nextIndex + count) % count);
	};

	createEffect(() => {
		void query();
		void filteredActions().length;
		setActiveIndex(0);
	});

	return (
		<>
			<Dialog onOpenChange={setPaletteOpen} open={props.paletteOpen}>
				<DialogContent class="workspace-theme max-w-xl overflow-hidden p-0">
					<DialogHeader class="sr-only">
						<DialogTitle>Quick actions</DialogTitle>
						<DialogDescription>
							Search navigation and application actions.
						</DialogDescription>
					</DialogHeader>
					<div class="flex h-12 items-center gap-2 border-border border-b px-4 pr-12">
						<Search
							aria-hidden="true"
							class="shrink-0 text-muted-foreground"
							size={18}
						/>
						<input
							aria-activedescendant={
								filteredActions().length > 0 ? itemId(activeIndex()) : undefined
							}
							aria-autocomplete="list"
							aria-controls={listId}
							aria-expanded="true"
							aria-label="Search quick actions"
							autocomplete="off"
							autofocus
							class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							onInput={(event) => setQuery(event.currentTarget.value)}
							onKeyDown={(event) => {
								if (event.key === "ArrowDown") {
									event.preventDefault();
									moveActive(activeIndex() + 1);
								} else if (event.key === "ArrowUp") {
									event.preventDefault();
									moveActive(activeIndex() - 1);
								} else if (event.key === "Home") {
									event.preventDefault();
									setActiveIndex(0);
								} else if (event.key === "End") {
									event.preventDefault();
									setActiveIndex(Math.max(filteredActions().length - 1, 0));
								} else if (event.key === "Enter") {
									const action = filteredActions()[activeIndex()];
									if (action) {
										event.preventDefault();
										runAction(action);
									}
								}
							}}
							placeholder="Search actions…"
							role="combobox"
							value={query()}
						/>
					</div>
					<div
						class="max-h-menu-small overflow-y-auto overscroll-contain p-2 scrollbar-stable"
						id={listId}
						role="listbox"
					>
						<Show
							fallback={
								<p class="px-3 py-8 text-center text-muted-foreground text-sm">
									No matching action.
								</p>
							}
							when={filteredActions().length > 0}
						>
							<For each={groupedActions()}>
								{(actionGroup) => (
									<fieldset
										aria-label={actionGroup.group}
										class="m-0 min-w-0 border-0 p-0"
									>
										<p
											aria-hidden="true"
											class="px-2 pt-2 pb-1 font-semibold text-muted-foreground text-label-sm uppercase tracking-wide"
										>
											{actionGroup.group}
										</p>
										<For each={actionGroup.actions}>
											{(action, index) => {
												const Icon = action.icon;
												const flatIndex = () =>
													actionGroup.startIndex + index();
												return (
													<button
														aria-selected={activeIndex() === flatIndex()}
														class={`flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
															activeIndex() === flatIndex()
																? "bg-accent text-primary"
																: "hover:bg-muted"
														}`}
														id={itemId(flatIndex())}
														onClick={() => runAction(action)}
														onPointerMove={() => setActiveIndex(flatIndex())}
														role="option"
														tabIndex={-1}
														type="button"
													>
														<Icon
															aria-hidden="true"
															class="shrink-0"
															size={17}
														/>
														<span class="min-w-0 flex-1 truncate">
															{action.label}
														</span>
														<Show when={action.shortcutId}>
															{(shortcutId) => (
																<ShortcutKbd shortcutId={shortcutId()} />
															)}
														</Show>
													</button>
												);
											}}
										</For>
									</fieldset>
								)}
							</For>
						</Show>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog onOpenChange={props.onHelpOpenChange} open={props.helpOpen}>
				<DialogContent class="workspace-theme max-w-2xl overflow-hidden p-0">
					<DialogHeader class="border-border border-b px-5 py-4 pr-12">
						<DialogTitle>Keyboard shortcuts</DialogTitle>
						<DialogDescription>
							Use these commands anywhere they apply. Customize them in Settings
							→ Shortcuts.
						</DialogDescription>
					</DialogHeader>
					<div class="max-h-menu-tall overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-stable">
						<For each={SHORTCUT_GROUPS}>
							{(group) => (
								<section class="pt-5">
									<h3 class="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
										{group}
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
