import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { AssociationManager } from "@solid-imager/ui/association-manager";
import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import { ClipboardCopy } from "@solid-imager/ui/clipboard-copy";
import { CollapsibleRoot as Collapsible } from "@solid-imager/ui/collapsible";
import {
	Binary,
	ChevronDown,
	Scan,
	ScanSearch,
	Sparkles,
} from "@solid-imager/ui/icons";
import { activateSimilaritySearch } from "@solid-imager/ui/stores/search-store";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import {
	type Accessor,
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { AiTaggingModal } from "~/components/media/ai-tagging-modal";
import { CharacterCropModal } from "~/components/media/character-crop-modal";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	getCcipVectorStatus,
	startCcipExtraction,
} from "~/infrastructure/api-clients/ai-api";
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
import { buildMediaContentUrl } from "~/infrastructure/media/thumbnail-runtime";
import { getApiFetch } from "~/infrastructure/tauri-fetch-helpers";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/queries";
import { OppaiOracleModal } from "./oppai-oracle-modal";

export type TauriMediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: Accessor<boolean>;
	onUpdate?: () => void;
};

function formatBytes(bytes: number, decimals = 2) {
	if (bytes === 0) return "0 Bytes";
	const units = ["Bytes", "KB", "MB", "GB", "TB"];
	const index = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${Number.parseFloat((bytes / 1024 ** index).toFixed(Math.max(0, decimals)))} ${units[index]}`;
}

export function TauriMediaSidebar(props: TauriMediaSidebarProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [description, setDescription] = createSignal(
		props.media.description ?? "",
	);
	const [editingDescription, setEditingDescription] = createSignal(false);
	const [aiTaggingOpen, setAiTaggingOpen] = createSignal(false);
	const [oppaiOpen, setOppaiOpen] = createSignal(false);
	const [characterCropOpen, setCharacterCropOpen] = createSignal(false);
	const [ccipStatus, setCcipStatus] = createSignal<
		"missing" | "processing" | "ready" | "stale" | "failed"
	>("missing");
	const [ccipJobId, setCcipJobId] = createSignal<string | null>(null);
	const [ccipPending, setCcipPending] = createSignal(false);
	const [ccipExtracting, setCcipExtracting] = createSignal(false);
	let statusRequestId = 0;

	const projects = createQuery(() =>
		projectsForMediaQueryOptions(props.media.mediaSourceId, props.media.id),
	);
	const allProjects = createQuery(allProjectsQueryOptions);
	const allIps = createQuery(allIpsQueryOptions);
	const allCharacters = createQuery(allCharactersQueryOptions);
	const positiveTags = createMemo(() =>
		(props.media.tags ?? []).filter((tag) => tag.type === "positive"),
	);
	const negativeTags = createMemo(() =>
		(props.media.tags ?? []).filter((tag) => tag.type === "negative"),
	);
	const availableCharacters = createMemo(() => {
		const currentIpIds = new Set((props.media.ips ?? []).map((ip) => ip.id));
		const characters = allCharacters.data ?? [];
		return currentIpIds.size === 0
			? characters
			: characters.filter((character) =>
					character.ips.some((ip) => currentIpIds.has(ip.id)),
				);
	});

	const refreshCcipStatus = async () => {
		const requestId = ++statusRequestId;
		try {
			const result = await getCcipVectorStatus(
				props.media.mediaSourceId,
				props.media.id,
			);
			if (requestId !== statusRequestId) return;
			setCcipStatus(result.status);
			setCcipJobId(result.jobId ?? null);
			setCcipPending(result.status === "processing");
		} catch {
			if (requestId !== statusRequestId) return;
			setCcipStatus("failed");
			setCcipJobId(null);
			setCcipPending(false);
		}
	};

	createEffect(
		on([() => props.media.id, () => props.media.mediaSourceId], () => {
			setDescription(props.media.description ?? "");
			setEditingDescription(false);
			setCcipStatus("missing");
			setCcipJobId(null);
			setCcipPending(false);
			void refreshCcipStatus();
		}),
	);
	createEffect(() => {
		if (!ccipPending() || !ccipJobId()) return;
		const intervalId = setInterval(() => void refreshCcipStatus(), 1000);
		onCleanup(() => clearInterval(intervalId));
	});
	useBatchJobEvents(
		ccipJobId,
		{
			handleJobProgress: () => {
				setCcipStatus("processing");
				setCcipPending(true);
			},
			handleJobCompleted: () => void refreshCcipStatus(),
			handleJobFailed: (event) => {
				setCcipStatus("failed");
				setCcipJobId(null);
				setCcipPending(false);
				if (event.error) toast.error(`CCIP extraction failed: ${event.error}`);
			},
		},
		{ subscribeImmediately: true },
	);

	const saveDescription = async () => {
		try {
			await updateMedia(props.media.mediaSourceId, props.media.id, {
				description: description(),
			});
			setEditingDescription(false);
			props.onUpdate?.();
		} catch (error) {
			toast.error(`Failed to update description: ${getErrorMessage(error)}`);
		}
	};
	const invalidateProjects = () =>
		queryClient.invalidateQueries({
			queryKey: projectsForMediaQueryOptions(
				props.media.mediaSourceId,
				props.media.id,
			).queryKey,
		});
	const addProject = async (id: string) => {
		await addProjectToMedia(props.media.id, id);
		await invalidateProjects();
		props.onUpdate?.();
	};
	const addIp = async (id: string) => {
		await addIpToMedia(props.media.id, id);
		props.onUpdate?.();
	};
	const addCharacter = async (id: string) => {
		await addCharacterToMedia(props.media.id, id);
		props.onUpdate?.();
	};
	const startExtraction = async () => {
		setCcipExtracting(true);
		try {
			const result = await startCcipExtraction(
				props.media.mediaSourceId,
				props.media.id,
				ccipStatus() === "ready" || ccipStatus() === "stale",
			);
			setCcipJobId(result.jobId);
			setCcipStatus("processing");
			setCcipPending(true);
			toast.success("CCIP vector extraction queued");
		} catch (error) {
			toast.error(`Failed to extract CCIP vector: ${getErrorMessage(error)}`);
		} finally {
			setCcipExtracting(false);
		}
	};

	return (
		<aside class="min-w-0 divide-y divide-[var(--app-border)] bg-[var(--app-surface-subtle)] px-4 pb-6 text-[var(--app-text)] lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 [scrollbar-gutter:stable]">
			<div class="space-y-2">
				<h2 class="font-semibold text-sm">Actions</h2>
				<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
					<Button onClick={() => setAiTaggingOpen(true)}>
						<Sparkles aria-hidden="true" size={15} /> Extract tags
					</Button>
					<Button onClick={() => setOppaiOpen(true)} variant="outline">
						<Sparkles aria-hidden="true" size={15} /> OppaiOracle
					</Button>
					<Button onClick={() => setCharacterCropOpen(true)} variant="outline">
						<Scan aria-hidden="true" size={15} /> Detect &amp; crop
					</Button>
					<Button
						disabled={ccipExtracting() || ccipPending()}
						onClick={() => void startExtraction()}
						variant="outline"
					>
						<Binary aria-hidden="true" size={15} />
						{ccipPending() ? "Extracting CCIP…" : "Extract CCIP vector"}
					</Button>
					<Button
						disabled={ccipStatus() !== "ready"}
						onClick={() => {
							activateSimilaritySearch(props.media.id);
							void navigate({ to: "/search" });
						}}
						variant="outline"
					>
						<ScanSearch aria-hidden="true" size={15} /> Find similar
					</Button>
				</div>
			</div>

			<div class="space-y-2">
				<div class="flex items-start justify-between gap-2">
					<h2 class="font-semibold text-sm">Description</h2>
					<Show when={!editingDescription()}>
						<button
							class="min-h-11 px-2 text-[var(--app-primary)] text-sm hover:underline"
							onClick={() => setEditingDescription(true)}
							type="button"
						>
							Edit
						</button>
					</Show>
				</div>
				<Show
					fallback={
						<div class="rounded-md bg-[var(--app-surface-muted)] p-3 text-[var(--app-text-muted)] text-sm italic">
							No description
						</div>
					}
					when={editingDescription() || Boolean(props.media.description)}
				>
					<Show
						fallback={
							<div class="whitespace-pre-wrap rounded-md bg-[var(--app-surface-muted)] p-3 text-sm">
								{props.media.description}
							</div>
						}
						when={editingDescription()}
					>
						<textarea
							class="w-full rounded-md border border-[var(--app-border-strong)] bg-[var(--app-surface)] p-2 text-base sm:text-sm"
							onInput={(event) => setDescription(event.currentTarget.value)}
							rows={5}
							value={description()}
						/>
						<div class="mt-2 flex gap-2">
							<Button onClick={() => void saveDescription()} size="sm">
								Save
							</Button>
							<Button
								onClick={() => {
									setDescription(props.media.description ?? "");
									setEditingDescription(false);
								}}
								size="sm"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
					</Show>
				</Show>
			</div>

			<Show when={(props.media.urls?.length ?? 0) > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Source URLs</h2>
					<For each={props.media.urls}>
						{(url) => (
							<a
								class="block break-all text-[var(--app-primary)] text-sm hover:underline"
								href={url.url}
								rel="noopener noreferrer"
								target="_blank"
							>
								{url.url}
							</a>
						)}
					</For>
				</div>
			</Show>

			<Show when={(props.media.authors?.length ?? 0) > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Authors</h2>
					<For each={props.media.authors}>
						{(author) => <p class="font-medium text-sm">{author.name}</p>}
					</For>
				</div>
			</Show>

			<div class="space-y-4">
				<h2 class="font-semibold text-sm">Relations</h2>
				<AssociationManager
					availableItems={allProjects.data ?? []}
					isLoading={projects.isLoading || props.isUpdating?.()}
					items={projects.data ?? []}
					onAdd={addProject}
					onCreate={async (name) => {
						const project = await createProject({ name });
						await addProject(project.id);
					}}
					onRemove={async (id) => {
						await removeProjectFromMedia(props.media.id, id);
						await invalidateProjects();
						props.onUpdate?.();
					}}
					title="Projects"
				/>
				<AssociationManager
					availableItems={allIps.data ?? []}
					isLoading={props.isUpdating?.()}
					items={props.media.ips ?? []}
					onAdd={addIp}
					onCreate={async (name) => {
						const ip = await createIp({ name });
						await addIp(ip.id);
					}}
					onRemove={async (id) => {
						await removeIpFromMedia(props.media.id, id);
						props.onUpdate?.();
					}}
					title="IPs"
				/>
				<AssociationManager
					availableItems={availableCharacters()}
					isLoading={props.isUpdating?.()}
					items={props.media.characters ?? []}
					onAdd={addCharacter}
					onCreate={async (name) => {
						const character = await createCharacter({ name });
						await addCharacter(character.id);
					}}
					onRemove={async (id) => {
						await removeCharacterFromMedia(props.media.id, id);
						props.onUpdate?.();
					}}
					title="Characters"
				/>
			</div>

			<Show when={positiveTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Positive Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={positiveTags()}>
							{(tag) => (
								<Badge variant="outline">
									{tag.name}
									<ClipboardCopy
										class="ml-1.5 p-0.5"
										iconSize={12}
										text={tag.name}
									/>
								</Badge>
							)}
						</For>
					</div>
				</div>
			</Show>
			<Show when={negativeTags().length > 0}>
				<div class="space-y-2">
					<h2 class="font-semibold text-sm">Negative Tags</h2>
					<div class="flex flex-wrap gap-2">
						<For each={negativeTags()}>
							{(tag) => (
								<Badge variant="destructive">
									{tag.name}
									<ClipboardCopy
										class="ml-1.5 p-0.5"
										iconSize={12}
										text={tag.name}
									/>
								</Badge>
							)}
						</For>
					</div>
				</div>
			</Show>

			<Show when={props.media.generationInfo}>
				<div class="space-y-2">
					<Collapsible.Root>
						<Collapsible.Trigger class="flex w-full items-center justify-between font-semibold text-sm">
							Generation Info <ChevronDown size={14} />
						</Collapsible.Trigger>
						<Collapsible.Content class="space-y-2 text-sm">
							<Show when={props.media.generationInfo?.prompt}>
								<p class="whitespace-pre-wrap rounded bg-[var(--app-surface-muted)] p-2 text-xs">
									{props.media.generationInfo?.prompt}
								</p>
							</Show>
							<Show when={props.media.generationInfo?.negativePrompt}>
								<p class="whitespace-pre-wrap rounded bg-[var(--app-surface-muted)] p-2 text-xs">
									{props.media.generationInfo?.negativePrompt}
								</p>
							</Show>
						</Collapsible.Content>
					</Collapsible.Root>
				</div>
			</Show>

			<div class="space-y-2">
				<h2 class="font-semibold text-sm">File information</h2>
				<dl class="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
					<dt class="text-[var(--app-text-muted)]">Resolution</dt>
					<dd class="text-right">
						{props.media.width} × {props.media.height}
					</dd>
					<dt class="text-[var(--app-text-muted)]">File Size</dt>
					<dd class="text-right">
						{props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
					</dd>
					<dt class="text-[var(--app-text-muted)]">Path</dt>
					<dd class="min-w-0 break-all text-right text-xs">
						{props.media.filePath}
					</dd>
				</dl>
			</div>

			<AiTaggingModal
				fileName={props.media.fileName}
				isOpen={aiTaggingOpen()}
				loadFile={async () => {
					const response = await getApiFetch()(
						buildMediaContentUrl(props.media.mediaSourceId, props.media.id),
					);
					if (!response.ok) {
						throw new Error(`Failed to fetch media: ${response.status}`);
					}
					return new File([await response.blob()], props.media.fileName);
				}}
				onClose={() => setAiTaggingOpen(false)}
			/>
			<OppaiOracleModal
				isOpen={oppaiOpen()}
				mediaId={props.media.id}
				mediaSourceId={props.media.mediaSourceId}
				onClose={() => setOppaiOpen(false)}
			/>
			<CharacterCropModal
				isOpen={characterCropOpen()}
				media={props.media}
				onClose={() => setCharacterCropOpen(false)}
			/>
		</aside>
	);
}
