import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import { ClipboardCopy } from "@solid-imager/ui/clipboard-copy";
import { CollapsibleRoot as Collapsible } from "@solid-imager/ui/collapsible";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { getTauriAppServices } from "../../app-services";
import {
	addCharacterToMedia,
	createCharacter,
	fetchAllCharacters,
	removeCharacterFromMedia,
} from "../../infrastructure/api-clients/characters-api";
import {
	addIpToMedia,
	createIp,
	fetchAllIps,
	removeIpFromMedia,
} from "../../infrastructure/api-clients/ips-api";
import { updateMedia } from "../../infrastructure/api-clients/media-api";
import {
	addProjectToMedia,
	createProject,
	fetchAllProjects,
	fetchProjectsForMedia,
	removeProjectFromMedia,
} from "../../infrastructure/api-clients/projects-api";
import { joinLocalPath } from "../../infrastructure/path-utils";
import { AiTaggingModal } from "./ai-tagging-modal";
import { AssociationManager } from "./association-manager";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
	sourceRootPath?: string;
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
	const queryClient = useQueryClient();
	const tags = createMemo(() => props.media.tags || []);
	const [isAiTaggingModalOpen, setIsAiTaggingModalOpen] = createSignal(false);
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description || "",
	);

	createEffect(() => {
		setDescriptionValue(props.media.description || "");
	});

	const positiveTags = createMemo(() =>
		tags().filter((tag) => tag.type === "positive"),
	);
	const negativeTags = createMemo(() =>
		tags().filter((tag) => tag.type === "negative"),
	);
	const genInfo = createMemo(() => props.media.generationInfo);

	const projects = createQuery(() => ({
		queryKey: ["projectsForMedia", props.media.id],
		queryFn: () =>
			fetchProjectsForMedia(props.media.mediaSourceId, props.media.id),
	}));
	const allProjects = createQuery(() => ({
		queryKey: ["allProjects"],
		queryFn: fetchAllProjects,
	}));
	const allIps = createQuery(() => ({
		queryKey: ["allIps"],
		queryFn: fetchAllIps,
	}));
	const allCharacters = createQuery(() => ({
		queryKey: ["allCharacters"],
		queryFn: fetchAllCharacters,
	}));

	const availableCharacters = createMemo(() => {
		const currentIps = props.media.ips || [];
		const characters = allCharacters.data || [];
		if (currentIps.length === 0) {
			return characters;
		}
		const ipIds = new Set(currentIps.map((ip) => ip.id));
		return characters.filter((character) =>
			character.ips.some((ip) => ipIds.has(ip.id)),
		);
	});

	const handleSaveDescription = async () => {
		try {
			await updateMedia(props.media.mediaSourceId, props.media.id, {
				description: descriptionValue(),
			});
			props.onUpdate?.();
			setIsEditingDescription(false);
		} catch (error) {
			toast.error(`Failed to update description: ${(error as Error).message}`);
		}
	};

	const handleCancelEdit = () => {
		setDescriptionValue(props.media.description || "");
		setIsEditingDescription(false);
	};

	const handleAddProject = async (projectId: string) => {
		await addProjectToMedia(
			props.media.mediaSourceId,
			props.media.id,
			projectId,
		);
		await queryClient.invalidateQueries({
			queryKey: ["projectsForMedia", props.media.id],
		});
	};

	const handleRemoveProject = async (projectId: string) => {
		await removeProjectFromMedia(
			props.media.mediaSourceId,
			props.media.id,
			projectId,
		);
		await queryClient.invalidateQueries({
			queryKey: ["projectsForMedia", props.media.id],
		});
	};

	const handleCreateProject = async (name: string) => {
		const project = await createProject({ name });
		await handleAddProject(project.id);
		await queryClient.invalidateQueries({ queryKey: ["allProjects"] });
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
		const ip = await createIp({ name });
		await handleAddIp(ip.id);
		await queryClient.invalidateQueries({ queryKey: ["allIps"] });
	};

	const handleAddCharacter = async (characterId: string) => {
		await addCharacterToMedia(
			props.media.mediaSourceId,
			props.media.id,
			characterId,
		);
		props.onUpdate?.();

		const character = allCharacters.data?.find(
			(item) => item.id === characterId,
		);
		if (!character) {
			return;
		}

		const currentIpIds = new Set((props.media.ips || []).map((ip) => ip.id));
		for (const ip of character.ips) {
			if (!currentIpIds.has(ip.id)) {
				await handleAddIp(ip.id);
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
		const character = await createCharacter({ name });
		await handleAddCharacter(character.id);
		await queryClient.invalidateQueries({ queryKey: ["allCharacters"] });
	};

	const loadMediaFile = async () => {
		const sourceRootPath = props.sourceRootPath;
		if (!sourceRootPath) {
			throw new Error("Source root path is not available.");
		}
		const bytes = await getTauriAppServices().fileSystem.readFile(
			joinLocalPath(sourceRootPath, props.media.filePath),
		);
		const buffer = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(buffer).set(bytes);
		return new File([buffer], props.media.fileName);
	};

	return (
		<aside class="h-full space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-4">
			<div>
				<h1 class="font-bold text-xl">{props.media.fileName}</h1>
				<p class="text-gray-500 text-sm">{props.media.filePath}</p>
			</div>

			<div class="flex gap-2">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700"
					onClick={() => setIsAiTaggingModalOpen(true)}
					type="button"
				>
					<span class="i-lucide-sparkles" />
					Extract Tags (AI)
				</button>
			</div>

			<AiTaggingModal
				fileName={props.media.fileName}
				isOpen={isAiTaggingModalOpen()}
				loadFile={loadMediaFile}
				onClose={() => setIsAiTaggingModalOpen(false)}
			/>

			<div class="space-y-2">
				<h2 class="font-semibold text-lg">Details</h2>
				<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
					<dt class="font-medium text-gray-600">Resolution</dt>
					<dd class="text-gray-800">
						{props.media.width} x {props.media.height}
					</dd>
					<dt class="font-medium text-gray-600">File Size</dt>
					<dd class="text-gray-800">
						{props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
					</dd>
					<dt class="font-medium text-gray-600">Status</dt>
					<dd class="text-gray-800">{props.media.status}</dd>
				</dl>
			</div>

			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h2 class="font-semibold text-lg">Description</h2>
					<Show when={!isEditingDescription()}>
						<button
							class="text-blue-600 text-sm hover:underline"
							onClick={() => setIsEditingDescription(true)}
							type="button"
						>
							Edit
						</button>
					</Show>
				</div>
				<Show
					fallback={
						<div class="rounded-md bg-gray-100 p-3 text-gray-500 text-sm italic">
							No description
						</div>
					}
					when={isEditingDescription() || props.media.description}
				>
					<Show
						fallback={
							<div class="whitespace-pre-wrap rounded-md bg-gray-100 p-3 text-sm">
								{props.media.description}
							</div>
						}
						when={isEditingDescription()}
					>
						<textarea
							class="w-full rounded-md border border-gray-300 p-2 text-sm"
							onInput={(event) =>
								setDescriptionValue(event.currentTarget.value)
							}
							placeholder="Enter description..."
							rows={6}
							value={descriptionValue()}
						/>
						<div class="flex gap-2">
							<Button onClick={handleSaveDescription} size="sm">
								Save
							</Button>
							<Button onClick={handleCancelEdit} size="sm" variant="outline">
								Cancel
							</Button>
						</div>
					</Show>
				</Show>
			</div>

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

			<Show when={props.media.authors?.length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-lg">Authors</h2>
					<ul class="space-y-1">
						<For each={props.media.authors}>
							{(author) => (
								<li>
									<div class="flex items-center gap-2">
										<span class="font-medium">{author.name}</span>
										<Show when={author.accountId}>
											<span class="text-gray-500 text-xs">
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
							<span class="i-lucide-chevron-down ui-expanded:rotate-180 transition-transform" />
						</Collapsible.Trigger>
						<Collapsible.Content class="space-y-2 text-sm">
							<Show when={genInfo()?.prompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">Prompt:</span>
										<ClipboardCopy text={genInfo()?.prompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{genInfo()?.prompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.negativePrompt}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">
											Negative Prompt:
										</span>
										<ClipboardCopy text={genInfo()?.negativePrompt ?? ""} />
									</div>
									<p class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{genInfo()?.negativePrompt}
									</p>
								</div>
							</Show>
							<Show when={genInfo()?.workflow}>
								<div>
									<div class="mb-1 flex items-center justify-between">
										<span class="font-medium text-gray-600">Workflow:</span>
										<ClipboardCopy
											text={
												genInfo()?.workflow
													? JSON.stringify(genInfo()?.workflow)
													: ""
											}
										/>
									</div>
									<pre class="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-gray-100 p-2 text-xs">
										{JSON.stringify(genInfo()?.workflow, null, 2)}
									</pre>
								</div>
							</Show>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</Show>
		</aside>
	);
}
