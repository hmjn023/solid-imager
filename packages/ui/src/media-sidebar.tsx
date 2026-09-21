import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
// biome-ignore lint/suspicious/noDeprecatedImports: TanStack Router's current Solid custom navigation-blocking API is exported under this deprecated annotation.
import { useBlocker } from "@tanstack/solid-router";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	For,
	Show,
} from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { AssociationManager } from "./association-manager";
import { Badge } from "./badge";
import { Button } from "./button";
import { ClipboardCopy } from "./clipboard-copy";
import { CollapsibleRoot as Collapsible } from "./collapsible";
import { toast } from "./toast";
import { ChevronDown } from "./workspace/icons";

export type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: Accessor<boolean>;
	projects: Project[];
	allProjects: Project[];
	allIps: Ip[];
	allCharacters: Character[];
	isProjectsLoading?: boolean;
	isAllIpsLoading?: boolean;
	isAllCharactersLoading?: boolean;
	onUpdate?: () => void;
	onDescriptionUpdate: (description: string) => void | Promise<void>;
	onProjectAdd: (projectId: string) => void | Promise<void>;
	onProjectRemove: (projectId: string) => void | Promise<void>;
	onProjectCreate: (name: string) => Promise<{ id: string }>;
	onIpAdd: (ipId: string) => void | Promise<void>;
	onIpRemove: (ipId: string) => void | Promise<void>;
	onIpCreate: (name: string) => Promise<{ id: string }>;
	onCharacterAdd: (characterId: string) => void | Promise<void>;
	onCharacterRemove: (characterId: string) => void | Promise<void>;
	onCharacterCreate: (name: string) => Promise<{ id: string }>;
};

function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) {
		return "0 Bytes";
	}
	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export function MediaSidebar(props: MediaSidebarProps) {
	const tags = createMemo(() => props.media.tags || []);
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description || "",
	);
	const descriptionDirty = () =>
		isEditingDescription() &&
		descriptionValue() !== (props.media.description ?? "");
	const navigationBlocker = useBlocker({
		shouldBlockFn: descriptionDirty,
		enableBeforeUnload: descriptionDirty,
		withResolver: true,
	});
	const [allowBlockedNavigation, setAllowBlockedNavigation] =
		createSignal(false);

	createEffect(() => {
		if (!isEditingDescription()) {
			setDescriptionValue(props.media.description || "");
		}
	});

	const positiveTags = createMemo(() =>
		tags().filter((tag) => tag.type === "positive"),
	);

	const negativeTags = createMemo(() =>
		tags().filter((tag) => tag.type === "negative"),
	);

	const genInfo = createMemo(() => props.media.generationInfo);

	const availableCharacters = createMemo(() => {
		const currentIps = props.media.ips || [];
		const allChars = props.allCharacters || [];

		if (currentIps.length === 0) {
			return allChars;
		}

		const ipIds = new Set(currentIps.map((ip) => ip.id));
		return allChars.filter((char) => char.ips.some((ip) => ipIds.has(ip.id)));
	});

	const handleSaveDescription = async () => {
		try {
			await props.onDescriptionUpdate(descriptionValue());
			setIsEditingDescription(false);
			props.onUpdate?.();
		} catch (error) {
			toast.error(`Failed to update description: ${getErrorMessage(error)}`);
		}
	};

	const handleCancelEdit = () => {
		setDescriptionValue(props.media.description || "");
		setIsEditingDescription(false);
	};

	const handleCreateProject = async (name: string) => {
		const newProject = await props.onProjectCreate(name);
		await props.onProjectAdd(newProject.id);
	};

	const handleCreateIp = async (name: string) => {
		const newIp = await props.onIpCreate(name);
		await props.onIpAdd(newIp.id);
	};

	const handleAddCharacter = async (characterId: string) => {
		await props.onCharacterAdd(characterId);
		props.onUpdate?.();

		const character = props.allCharacters.find((c) => c.id === characterId);
		if (character?.ips && character.ips.length > 0) {
			const currentIpIds = new Set((props.media.ips || []).map((ip) => ip.id));
			const ipsToAdd = character.ips.filter(
				(charIp) => !currentIpIds.has(charIp.id),
			);
			await Promise.all(ipsToAdd.map((charIp) => props.onIpAdd(charIp.id)));
		}
	};

	const handleCreateCharacter = async (name: string) => {
		const newCharacter = await props.onCharacterCreate(name);
		await handleAddCharacter(newCharacter.id);
	};

	return (
		<aside class="min-w-0 divide-y divide-[var(--workspace-border)] bg-[var(--workspace-surface-subtle)] px-4 pb-6 text-[var(--workspace-text)] lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 [scrollbar-gutter:stable]">
			<div class="space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h2 class="font-semibold text-sm">Description</h2>
					<Show when={!isEditingDescription()}>
						<button
							class="min-h-11 px-2 text-[var(--workspace-primary)] text-sm hover:underline"
							onClick={() => setIsEditingDescription(true)}
							type="button"
						>
							Edit
						</button>
					</Show>
				</div>
				<Show
					fallback={
						<div class="rounded-md bg-muted p-3 text-muted-foreground text-sm italic">
							No description
						</div>
					}
					when={isEditingDescription() || props.media.description}
				>
					<Show
						fallback={
							<div class="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
								{props.media.description}
							</div>
						}
						when={isEditingDescription()}
					>
						<textarea
							class="w-full scroll-mb-24 rounded-md border border-input bg-background p-2 text-base sm:text-sm"
							onInput={(e) => setDescriptionValue(e.currentTarget.value)}
							placeholder="Enter description..."
							rows={6}
							value={descriptionValue()}
						/>
						<div class="sticky bottom-0 z-10 -mx-3 flex flex-col gap-2 border-t bg-background px-3 py-3 sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:flex-row lg:border-0 lg:bg-transparent lg:p-0">
							<Button
								class="w-full lg:w-auto"
								onClick={() => {
									void handleSaveDescription();
								}}
								size="sm"
							>
								Save
							</Button>
							<Button
								class="w-full lg:w-auto"
								onClick={handleCancelEdit}
								size="sm"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</Show>
				</Show>
			</div>

			<Show when={props.media.urls?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Source URLs</h2>
					<ul class="space-y-1">
						<For each={props.media.urls}>
							{(url) => (
								<li>
									<a
										class="block break-all text-[var(--workspace-primary)] text-sm hover:underline"
										href={url.url}
										rel="noopener noreferrer"
										target="_blank"
									>
										{url.url}
									</a>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			<Show when={props.media.authors?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Authors</h2>
					<ul class="space-y-1">
						<For each={props.media.authors}>
							{(author) => (
								<li>
									<div class="flex min-w-0 items-center gap-2">
										<span class="break-words font-medium">{author.name}</span>
										<Show when={author.accountId}>
											<span class="break-all text-muted-foreground text-xs">
												({author.accountId})
											</span>
										</Show>
									</div>
								</li>
							)}
						</For>
					</ul>
				</div>
			</Show>

			<div class="space-y-4">
				<h2 class="font-semibold text-sm">Relations</h2>
				<AssociationManager
					availableItems={props.allProjects}
					isLoading={props.isProjectsLoading || props.isUpdating?.()}
					items={props.projects}
					onAdd={props.onProjectAdd}
					onCreate={handleCreateProject}
					onRemove={props.onProjectRemove}
					title="Projects"
				/>

				<AssociationManager
					availableItems={props.allIps}
					isLoading={props.isAllIpsLoading || props.isUpdating?.()}
					items={props.media.ips || []}
					onAdd={props.onIpAdd}
					onCreate={handleCreateIp}
					onRemove={props.onIpRemove}
					title="IPs"
				/>

				<AssociationManager
					availableItems={availableCharacters()}
					isLoading={props.isAllCharactersLoading || props.isUpdating?.()}
					items={props.media.characters || []}
					onAdd={handleAddCharacter}
					onCreate={handleCreateCharacter}
					onRemove={props.onCharacterRemove}
					title="Characters"
				/>
			</div>

			<Show when={positiveTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Positive Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={positiveTags()}>
							{(tag) => {
								let badgeClass = "";
								if (tag.source === "AI") {
									badgeClass =
										"border-[var(--workspace-border-strong)] bg-[var(--workspace-info-surface)] text-[var(--workspace-info)]";
								} else if (tag.source === "comfyui_workflow") {
									badgeClass =
										"border-[var(--workspace-border-strong)] bg-[var(--workspace-surface-selected)] text-[var(--workspace-primary)]";
								}
								return (
									<Badge class={badgeClass} title={`Source: ${tag.source}`}>
										{tag.name}
										<ClipboardCopy
											class="ml-1.5 p-0.5"
											iconSize={12}
											text={tag.name}
										/>
									</Badge>
								);
							}}
						</For>
					</div>
				</div>
			</Show>

			<Show when={negativeTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Negative Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={negativeTags()}>
							{(tag) => {
								let badgeClass = "";
								if (tag.source === "AI") {
									badgeClass =
										"border-[var(--workspace-border-strong)] bg-[var(--workspace-surface-muted)] text-[var(--workspace-destructive)]";
								} else if (tag.source === "comfyui_workflow") {
									badgeClass =
										"border-[var(--workspace-border-strong)] bg-[var(--workspace-surface-muted)] text-[var(--workspace-destructive)]";
								}
								return (
									<Badge
										class={badgeClass}
										title={`Source: ${tag.source}`}
										variant="destructive"
									>
										{tag.name}
										<ClipboardCopy
											class="ml-1.5 p-0.5"
											iconSize={12}
											text={tag.name}
										/>
									</Badge>
								);
							}}
						</For>
					</div>
				</div>
			</Show>

			<Show when={genInfo()}>
				<div class="space-y-2">
					<Collapsible.Root>
						<Collapsible.Trigger class="flex w-full items-center justify-between font-semibold text-sm">
							Generation Info
							<ChevronDown
								class="ui-expanded:rotate-180 transition-transform"
								size={14}
							/>
						</Collapsible.Trigger>
						<Collapsible.Content class="space-y-2 text-sm">
							<Show when={genInfo()?.prompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											Prompt:
										</span>
										<ClipboardCopy text={genInfo()?.prompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{genInfo()?.prompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.negativePrompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											Negative Prompt:
										</span>
										<ClipboardCopy text={genInfo()?.negativePrompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{genInfo()?.negativePrompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.workflow}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-muted-foreground">
											Workflow:
										</span>
										<ClipboardCopy
											text={
												genInfo()?.workflow
													? JSON.stringify(genInfo()?.workflow)
													: ""
											}
										/>
									</div>
									<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
										{JSON.stringify(genInfo()?.workflow, null, 2)}
									</pre>
								</div>
							</Show>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</Show>

			<div class="space-y-2">
				<h2 class="font-semibold text-sm">File information</h2>
				<dl class="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
					<dt class="font-medium text-[var(--workspace-text-muted)]">
						Resolution
					</dt>
					<dd class="text-right text-[var(--workspace-text)]">
						{props.media.width} × {props.media.height}
					</dd>
					<dt class="font-medium text-[var(--workspace-text-muted)]">
						File Size
					</dt>
					<dd class="text-right text-[var(--workspace-text)]">
						{props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
					</dd>
					<dt class="font-medium text-[var(--workspace-text-muted)]">Path</dt>
					<dd class="min-w-0 break-all text-right text-[var(--workspace-text)] text-xs">
						{props.media.filePath}
					</dd>
				</dl>
			</div>

			<AlertDialog
				onOpenChange={(open) => {
					const resolver = navigationBlocker();
					if (!open && resolver.status === "blocked") {
						if (allowBlockedNavigation()) {
							setAllowBlockedNavigation(false);
							return;
						}
						resolver.reset?.();
					}
				}}
				open={navigationBlocker().status === "blocked"}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Unsaved description</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved changes to this description. Leave without
							saving?
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							onClick={() => {
								navigationBlocker().reset?.();
							}}
						>
							Stay
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								const resolver = navigationBlocker();
								if (resolver.status !== "blocked") return;
								setDescriptionValue(props.media.description ?? "");
								setIsEditingDescription(false);
								setAllowBlockedNavigation(true);
								resolver.proceed?.();
							}}
						>
							Leave
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</aside>
	);
}
