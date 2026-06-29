import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type {
	CcipVectorStatus,
	StartCcipExtractionResponse,
} from "@solid-imager/core/domain/tagging/schemas";
import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onMount,
	Show,
} from "solid-js";
import { AssociationManager } from "./association-manager";
import { Badge } from "./badge";
import { Button } from "./button";
import { ClipboardCopy } from "./clipboard-copy";
import { CollapsibleRoot as Collapsible } from "./collapsible";
import { toast } from "./toast";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	projects: Project[];
	allProjects: Project[];
	allIps: Ip[];
	allCharacters: Character[];
	isProjectsLoading?: boolean;
	isAllIpsLoading?: boolean;
	isAllCharactersLoading?: boolean;
	aiTaggingModal?: (props: {
		isOpen: boolean;
		onClose: () => void;
	}) => JSX.Element;

	characterCropModal?: (props: {
		isOpen: boolean;
		onClose: () => void;
	}) => JSX.Element;
	getCcipVectorStatus?: () => Promise<CcipVectorStatus>;
	startCcipExtraction?: (force: boolean) => Promise<StartCcipExtractionResponse>;
	useCcipJobEvents?: (
		activeJobId: () => string | null,
		handlers: {
			handleJobProgress: (event: JobProgressEvent) => void;
			handleJobCompleted: (event: JobCompletedEvent) => void;
			handleJobFailed: (event: JobFailedEvent) => void;
		},
	) => void;
	onFindSimilar?: () => void;
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
	const [isAiTaggingModalOpen, setIsAiTaggingModalOpen] = createSignal(false);

	const [isCharacterCropModalOpen, setIsCharacterCropModalOpen] =
		createSignal(false);
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [ccipStatus, setCcipStatus] =
		createSignal<CcipVectorStatus["status"]>("missing");
	const [activeCcipJobId, setActiveCcipJobId] = createSignal<string | null>(null);
	const [isExtractingCcip, setIsExtractingCcip] = createSignal(false);
	const [ccipStatusRequestId, setCcipStatusRequestId] = createSignal(0);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description || "",
	);

	createEffect(() => {
		if (!isEditingDescription()) {
			setDescriptionValue(props.media.description || "");
		}
	});

	const refreshCcipStatus = async () => {
		const requestId = ccipStatusRequestId() + 1;
		setCcipStatusRequestId(requestId);
		if (props.getCcipVectorStatus) {
			try {
				const result = await props.getCcipVectorStatus();
				if (ccipStatusRequestId() !== requestId) {
					return;
				}
				setCcipStatus(result.status);
				setActiveCcipJobId(result.jobId ?? null);
			} catch {
				if (ccipStatusRequestId() !== requestId) {
					return;
				}
				setCcipStatus("failed");
				setActiveCcipJobId(null);
			}
		}
	};

	createEffect(() => {
		props.media.id;
		props.media.mediaSourceId;
		setCcipStatus("missing");
		setActiveCcipJobId(null);
		void refreshCcipStatus();
	});

	const extractCcipVector = async () => {
		if (!props.startCcipExtraction) return;
		setIsExtractingCcip(true);
		const currentMediaId = props.media.id;
		try {
			const result = await props.startCcipExtraction(
				ccipStatus() === "ready" || ccipStatus() === "stale",
			);
			if (props.media.id !== currentMediaId) return;
			setCcipStatus("processing");
			setActiveCcipJobId(result.jobId);
			toast.success("CCIP vector extraction queued");
		} catch (error) {
			if (props.media.id !== currentMediaId) return;
			toast.error(`Failed to extract CCIP vector: ${getErrorMessage(error)}`);
		} finally {
			setIsExtractingCcip(false);
		}
	};

	props.useCcipJobEvents?.(activeCcipJobId, {
		handleJobProgress: () => {
			setCcipStatus("processing");
		},
		handleJobCompleted: () => {
			setActiveCcipJobId(null);
			void refreshCcipStatus();
		},
		handleJobFailed: (event) => {
			setCcipStatus("failed");
			setActiveCcipJobId(null);
			if (event.error) {
				toast.error(`Failed to extract CCIP vector: ${event.error}`);
			}
		},
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
		<aside class="h-full space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-4">
			<div>
				<h1 class="font-bold text-xl">{props.media.fileName}</h1>
				<p class="text-gray-500 text-sm">{props.media.filePath}</p>
			</div>

			<Show when={props.aiTaggingModal}>
				<div class="flex flex-col gap-2">
					<button
						class="flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700"
						onClick={() => setIsAiTaggingModalOpen(true)}
						type="button"
					>
						<span class="i-lucide-sparkles" />
						Extract Tags (AI)
					</button>

					<Show when={props.characterCropModal}>
						<button
							class="flex w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-teal-700"
							onClick={() => setIsCharacterCropModalOpen(true)}
							type="button"
						>
							<span class="i-lucide-scan" />
							Detect &amp; Crop Characters
						</button>
					</Show>
					<Show when={props.startCcipExtraction}>
						<Button
							disabled={isExtractingCcip() || ccipStatus() === "processing"}
							onClick={extractCcipVector}
							variant="outline"
						>
							<span class="i-lucide-binary" />
							{ccipStatus() === "ready" || ccipStatus() === "stale"
								? "Re-extract CCIP Vector"
								: ccipStatus() === "processing"
									? "Extracting CCIP Vector..."
									: "Extract CCIP Vector"}
						</Button>
					</Show>
					<Show when={ccipStatus() === "ready" && props.onFindSimilar}>
						<Button onClick={props.onFindSimilar} variant="outline">
							<span class="i-lucide-scan-search" />
							Find Similar
						</Button>
					</Show>
				</div>
			</Show>
			{props.aiTaggingModal?.({
				isOpen: isAiTaggingModalOpen(),
				onClose: () => setIsAiTaggingModalOpen(false),
			})}

			{props.characterCropModal?.({
				isOpen: isCharacterCropModalOpen(),
				onClose: () => setIsCharacterCropModalOpen(false),
			})}

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
							onInput={(e) => setDescriptionValue(e.currentTarget.value)}
							placeholder="Enter description..."
							rows={6}
							value={descriptionValue()}
						/>
						<div class="flex gap-2">
							<Button
								onClick={() => {
									void handleSaveDescription();
								}}
								size="sm"
							>
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
					availableItems={props.allProjects}
					isLoading={props.isProjectsLoading || props.isUpdating}
					items={props.projects}
					onAdd={props.onProjectAdd}
					onCreate={handleCreateProject}
					onRemove={props.onProjectRemove}
					title="Projects"
				/>

				<AssociationManager
					availableItems={props.allIps}
					isLoading={props.isAllIpsLoading || props.isUpdating}
					items={props.media.ips || []}
					onAdd={props.onIpAdd}
					onCreate={handleCreateIp}
					onRemove={props.onIpRemove}
					title="IPs"
				/>

				<AssociationManager
					availableItems={availableCharacters()}
					isLoading={props.isAllCharactersLoading || props.isUpdating}
					items={props.media.characters || []}
					onAdd={handleAddCharacter}
					onCreate={handleCreateCharacter}
					onRemove={props.onCharacterRemove}
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
