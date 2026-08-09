import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@solid-imager/ui/alert-dialog";
import { Badge } from "@solid-imager/ui/badge";
import { ClipboardCopy } from "@solid-imager/ui/clipboard-copy";
import { CollapsibleRoot as Collapsible } from "@solid-imager/ui/collapsible";
import { toast } from "@solid-imager/ui/toast";
import { ChevronDown } from "@solid-imager/ui/v2/icons";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
// biome-ignore lint/suspicious/noDeprecatedImports: the object overload used below is current; TanStack's legacy overload annotation marks the re-export.
import { useBlocker } from "@tanstack/solid-router";
import { createMemo, createSignal, For, Show } from "solid-js";
import AssociationManager from "~/components/media/association-manager";
import {
	addCharacterToMedia,
	createCharacter,
	removeCharacterFromMedia,
} from "~/infrastructure/api-clients/characters-api";
import {
	addIpToMedia,
	createIp,
	removeIpFromMedia,
} from "~/infrastructure/api-clients/ips-api";
import { updateMedia } from "~/infrastructure/api-clients/media-api";
import {
	addProjectToMedia,
	createProject,
	removeProjectFromMedia,
} from "~/infrastructure/api-clients/projects-api";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/infrastructure/api-clients/queries";

export type V2MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
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

export function V2MediaSidebar(props: V2MediaSidebarProps) {
	const queryClient = useQueryClient();
	const tags = createMemo(() => props.media.tags || []);

	// Description editing state
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

	const handleSaveDescription = async () => {
		try {
			await updateMedia(props.media.mediaSourceId, props.media.id, {
				description: descriptionValue(),
			});
			setIsEditingDescription(false);
			// Trigger refetch to update the UI
			props.onUpdate?.();
		} catch (error) {
			toast.error(`Failed to update description: ${getErrorMessage(error)}`);
		}
	};

	const handleCancelEdit = () => {
		setDescriptionValue(props.media.description || "");
		setIsEditingDescription(false);
	};

	const positiveTags = createMemo(() =>
		tags().filter((tag) => tag.type === "positive"),
	);

	const negativeTags = createMemo(() =>
		tags().filter((tag) => tag.type === "negative"),
	);

	const genInfo = createMemo(() => props.media.generationInfo);

	// Queries for associations
	const projects = createQuery(() =>
		projectsForMediaQueryOptions(props.media.mediaSourceId, props.media.id),
	);
	const allProjects = createQuery(() => allProjectsQueryOptions());
	const allIps = createQuery(() => allIpsQueryOptions());
	const allCharacters = createQuery(() => allCharactersQueryOptions());

	const handleAddProject = async (projectId: string) => {
		await addProjectToMedia(
			props.media.mediaSourceId,
			props.media.id,
			projectId,
		);
		queryClient.invalidateQueries({
			queryKey: projectsForMediaQueryOptions(
				props.media.mediaSourceId,
				props.media.id,
			).queryKey,
		});
		props.onUpdate?.();
	};

	const handleRemoveProject = async (projectId: string) => {
		await removeProjectFromMedia(
			props.media.mediaSourceId,
			props.media.id,
			projectId,
		);
		queryClient.invalidateQueries({
			queryKey: projectsForMediaQueryOptions(
				props.media.mediaSourceId,
				props.media.id,
			).queryKey,
		});
		props.onUpdate?.();
	};

	const handleCreateProject = async (name: string) => {
		const newProject = await createProject({ name });
		await handleAddProject(newProject.id);
		queryClient.invalidateQueries({
			queryKey: allProjectsQueryOptions().queryKey,
		});
	};

	const handleAddIp = async (ipId: string) => {
		await addIpToMedia(props.media.mediaSourceId, props.media.id, ipId);
		props.onUpdate?.();
	};

	const handleRemoveIp = async (ipId: string) => {
		await removeIpFromMedia(props.media.mediaSourceId, props.media.id, ipId);
		props.onUpdate?.();
	};

	const handleCreateIp = async (name: string) => {
		const newIp = await createIp({ name });
		await handleAddIp(newIp.id);
		queryClient.invalidateQueries({
			queryKey: allIpsQueryOptions().queryKey,
		});
	};

	const availableCharacters = createMemo(() => {
		const currentIps = props.media.ips || [];
		const allChars = allCharacters.data || [];

		if (currentIps.length === 0) {
			return allChars;
		}

		const ipIds = new Set(currentIps.map((ip) => ip.id));
		return allChars.filter((char: { ips: { id: string }[] }) =>
			char.ips.some((ip: { id: string }) => ipIds.has(ip.id)),
		);
	});

	const handleAddCharacter = async (characterId: string) => {
		await addCharacterToMedia(
			props.media.mediaSourceId,
			props.media.id,
			characterId,
		);
		props.onUpdate?.();

		// Auto-assign IPs if the character belongs to any
		const character = allCharacters.data?.find(
			(c: { id: string }) => c.id === characterId,
		);
		if (character?.ips && character.ips.length > 0) {
			const currentIpIds = new Set((props.media.ips || []).map((ip) => ip.id));
			for (const charIp of character.ips) {
				if (!currentIpIds.has(charIp.id)) {
					await handleAddIp(charIp.id);
				}
			}
		}
	};

	const handleRemoveCharacter = async (characterId: string) => {
		await removeCharacterFromMedia(
			props.media.mediaSourceId,
			props.media.id,
			characterId,
		);
		props.onUpdate?.();
	};

	const handleCreateCharacter = async (name: string) => {
		const newCharacter = await createCharacter({ name });
		await handleAddCharacter(newCharacter.id);
		queryClient.invalidateQueries({
			queryKey: allCharactersQueryOptions().queryKey,
		});
	};

	return (
		<aside class="min-w-0 divide-y divide-[var(--v2-border)] bg-[var(--v2-surface-subtle)] px-4 pb-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 [scrollbar-gutter:stable]">
			<div class="space-y-2">
				<h2 class="font-semibold text-lg">File information</h2>
				<dl class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm">
					<dt class="font-medium text-muted-foreground">Resolution</dt>
					<dd class="text-foreground">
						{props.media.width} x {props.media.height}
					</dd>
					<dt class="font-medium text-muted-foreground">File Size</dt>
					<dd class="text-foreground">
						{props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
					</dd>
					<dt class="font-medium text-muted-foreground">Path</dt>
					<dd class="min-w-0 max-w-52 break-all text-right text-foreground text-xs">
						{props.media.filePath}
					</dd>
				</dl>
			</div>

			{/* Description Section */}
			<div class="space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h2 class="font-semibold text-lg">Description</h2>
					<Show when={!isEditingDescription()}>
						<button
							class="min-h-11 px-2 text-blue-600 text-sm hover:underline"
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
							<button
								class="min-h-11 w-full rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 lg:w-auto"
								onClick={handleSaveDescription}
								type="button"
							>
								Save
							</button>
							<button
								class="min-h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm hover:bg-accent lg:w-auto"
								onClick={handleCancelEdit}
								type="button"
							>
								Cancel
							</button>
						</div>
					</Show>
				</Show>
			</div>

			{/* Source URLs Section */}
			<Show when={props.media.urls?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Source URLs</h2>
					<ul class="space-y-1">
						<For each={props.media.urls}>
							{(url) => (
								<li>
									<a
										class="block break-all text-blue-600 text-sm hover:underline"
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

			{/* Authors Section */}
			<Show when={props.media.authors?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Authors</h2>
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
				<h2 class="font-semibold text-lg">Relations</h2>
				<AssociationManager
					availableItems={allProjects.data || []}
					isLoading={projects.isLoading || props.isUpdating}
					items={projects.data || []}
					onAdd={handleAddProject}
					onCreate={handleCreateProject}
					onRemove={handleRemoveProject}
					title="Projects"
				/>

				<AssociationManager
					availableItems={allIps.data || []}
					isLoading={props.isUpdating}
					items={props.media.ips || []}
					onAdd={handleAddIp}
					onCreate={handleCreateIp}
					onRemove={handleRemoveIp}
					title="IPs"
				/>

				<AssociationManager
					availableItems={availableCharacters()}
					isLoading={props.isUpdating}
					items={props.media.characters || []}
					onAdd={handleAddCharacter}
					onCreate={handleCreateCharacter}
					onRemove={handleRemoveCharacter}
					title="Characters"
				/>
			</div>

			<Show when={positiveTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Positive Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={positiveTags()}>
							{(tag) => {
								let badgeClass = "";
								if (tag.source === "AI") {
									badgeClass =
										"bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200";
								} else if (tag.source === "comfyui_workflow") {
									badgeClass =
										"bg-green-100 text-green-800 hover:bg-green-200 border-green-200";
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
					<h2 class="font-semibold text-lg">Negative Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={negativeTags()}>
							{(tag) => {
								let badgeClass = "";
								if (tag.source === "AI") {
									badgeClass =
										"bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200 border";
								} else if (tag.source === "comfyui_workflow") {
									badgeClass =
										"bg-green-50 text-green-800 hover:bg-green-100 border-green-200 border";
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
						<Collapsible.Trigger class="flex w-full items-center justify-between font-semibold text-lg">
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
						<AlertDialogTitle>説明の変更を破棄しますか？</AlertDialogTitle>
						<AlertDialogDescription>
							保存されていない説明があります。このページを離れると入力内容は失われます。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>編集を続ける</AlertDialogCancel>
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
							破棄して移動
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</aside>
	);
}
