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
import { Button } from "@solid-imager/ui/button";
import { ClipboardCopy } from "@solid-imager/ui/clipboard-copy";
import { CollapsibleRoot as Collapsible } from "@solid-imager/ui/collapsible";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@solid-imager/ui/popover";
import { activateVectorSearch } from "@solid-imager/ui/stores/search-store";
import { toast } from "@solid-imager/ui/toast";
import {
	Binary,
	ChevronDown,
	Scan,
	ScanSearch,
	Sparkles,
} from "@solid-imager/ui/v2/icons";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
// biome-ignore lint/suspicious/noDeprecatedImports: the object overload used below is current; TanStack's legacy overload annotation marks the re-export.
import { useBlocker, useNavigate } from "@tanstack/solid-router";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	on,
	onCleanup,
	Show,
} from "solid-js";
import { AiTaggingModal } from "~/components/media/ai-tagging-modal";
import AssociationManager from "~/components/media/association-manager";
import CharacterCropModal from "~/components/media/character-crop-modal";
import { OppaiOracleModal } from "~/components/media/oppai-oracle-modal";
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
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	projectsForMediaQueryOptions,
} from "~/infrastructure/api-clients/queries";

type MediaSidebarProps = {
	media: MediaDetails;
	isUpdating?: boolean;
	onUpdate?: () => void;
	variant?: "default" | "v2";
};

type MediaActionsProps = Pick<
	MediaSidebarProps,
	"media" | "onUpdate" | "variant"
>;

const CCIP_STATUS_REFRESH_INTERVAL_MS = 1_000;
const CCIP_MISSING_STATUS_LIMIT = 5;

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

const CodeBlock = (props: { content: string }) => (
	<pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-100 p-2">
		<code class="text-sm">{props.content}</code>
	</pre>
);

const _CollapsibleSection = (props: {
	title: string;
	content: string | object;
}) => {
	const formattedContent =
		typeof props.content === "object" && props.content !== null
			? JSON.stringify(props.content, null, 2)
			: props.content;

	return (
		<Collapsible.Root class="w-full">
			<Collapsible.Trigger class="w-full cursor-pointer rounded-md bg-gray-200 px-3 py-2 text-left font-medium hover:bg-gray-300">
				{props.title}
			</Collapsible.Trigger>
			<Collapsible.Content>
				<CodeBlock content={formattedContent} />
			</Collapsible.Content>
		</Collapsible.Root>
	);
};

export function MediaActions(props: MediaActionsProps) {
	const navigate = useNavigate();
	const [isAiTaggingModalOpen, setIsAiTaggingModalOpen] = createSignal(false);
	const [isOppaiOracleModalOpen, setIsOppaiOracleModalOpen] =
		createSignal(false);
	const [isCharacterCropModalOpen, setIsCharacterCropModalOpen] =
		createSignal(false);
	const [ccipStatus, setCcipStatus] = createSignal<
		"missing" | "processing" | "ready" | "stale" | "failed"
	>("missing");
	const [activeCcipJobId, setActiveCcipJobId] = createSignal<string | null>(
		null,
	);
	const [isCcipJobPending, setIsCcipJobPending] = createSignal(false);
	const [isExtractingCcip, setIsExtractingCcip] = createSignal(false);
	const [ccipMissingStatusCount, setCcipMissingStatusCount] = createSignal(0);
	let ccipStatusRequestId = 0;

	const refreshCcipStatus = async () => {
		const requestId = ccipStatusRequestId + 1;
		ccipStatusRequestId = requestId;
		const activeJobIdAtRequest = activeCcipJobId();
		try {
			const result = await getCcipVectorStatus(
				props.media.mediaSourceId,
				props.media.id,
			);
			if (ccipStatusRequestId !== requestId) return;
			if (
				result.status === "missing" &&
				activeJobIdAtRequest &&
				activeCcipJobId() === activeJobIdAtRequest
			) {
				const missingStatusCount = ccipMissingStatusCount() + 1;
				setCcipMissingStatusCount(missingStatusCount);
				if (missingStatusCount >= CCIP_MISSING_STATUS_LIMIT) {
					setCcipStatus("failed");
					setActiveCcipJobId(null);
					setIsCcipJobPending(false);
				}
				return;
			}
			setCcipMissingStatusCount(0);
			setCcipStatus(result.status);
			setActiveCcipJobId(result.jobId ?? null);
			setIsCcipJobPending(result.status === "processing");
		} catch {
			if (ccipStatusRequestId !== requestId) return;
			if (activeCcipJobId()) return;
			setCcipStatus("failed");
			setActiveCcipJobId(null);
			setIsCcipJobPending(false);
		}
	};

	createEffect(
		on([() => props.media.id, () => props.media.mediaSourceId], () => {
			setIsExtractingCcip(false);
			setIsCcipJobPending(false);
			setCcipStatus("missing");
			setActiveCcipJobId(null);
			setCcipMissingStatusCount(0);
			void refreshCcipStatus();
		}),
	);

	const handleCcipExtraction = async () => {
		setIsExtractingCcip(true);
		const currentMediaId = props.media.id;
		const currentMediaSourceId = props.media.mediaSourceId;
		const isCurrentMedia = () =>
			props.media.id === currentMediaId &&
			props.media.mediaSourceId === currentMediaSourceId;
		try {
			const result = await startCcipExtraction(
				currentMediaSourceId,
				currentMediaId,
				ccipStatus() === "ready" || ccipStatus() === "stale",
			);
			if (!isCurrentMedia()) return;
			setCcipStatus("processing");
			setActiveCcipJobId(result.jobId);
			setIsCcipJobPending(true);
			setCcipMissingStatusCount(0);
			void refreshCcipStatus();
			toast.success("CCIP vector extraction queued");
		} catch (error) {
			if (!isCurrentMedia()) return;
			toast.error(`Failed to extract CCIP vector: ${getErrorMessage(error)}`);
		} finally {
			if (isCurrentMedia()) {
				setIsExtractingCcip(false);
			}
		}
	};

	useBatchJobEvents(
		() => activeCcipJobId(),
		{
			handleJobProgress: () => {
				setCcipStatus("processing");
				setIsCcipJobPending(true);
				setCcipMissingStatusCount(0);
			},
			handleJobCompleted: () => {
				void refreshCcipStatus();
			},
			handleJobFailed: (event) => {
				setCcipStatus("failed");
				setActiveCcipJobId(null);
				setIsCcipJobPending(false);
				setCcipMissingStatusCount(0);
				if (event.error) {
					toast.error(`Failed to extract CCIP vector: ${event.error}`);
				}
			},
		},
		{ subscribeImmediately: true },
	);

	createEffect(() => {
		if (!isCcipJobPending() || !activeCcipJobId()) {
			return;
		}
		const intervalId = setInterval(() => {
			void refreshCcipStatus();
		}, CCIP_STATUS_REFRESH_INTERVAL_MS);
		onCleanup(() => clearInterval(intervalId));
	});

	const handleFindSimilar = () => {
		activateVectorSearch(props.media.id);
		if (props.variant === "v2") {
			void navigate({ to: "/v2/search" });
			return;
		}
		void navigate({ to: "/search" });
	};
	const ccipActionLabel = () => {
		if (ccipStatus() === "ready" || ccipStatus() === "stale") {
			return "Re-extract CCIP vector";
		}
		if (ccipStatus() === "processing") return "Extracting CCIP vector…";
		return "Extract CCIP vector";
	};

	return (
		<>
			<Show
				fallback={
					<div class="flex flex-col gap-2">
						<button
							class="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700"
							onClick={() => setIsAiTaggingModalOpen(true)}
							type="button"
						>
							<Sparkles aria-hidden="true" size={16} />
							Extract Tags (AI)
						</button>
						<button
							class="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-orange-700"
							onClick={() => setIsOppaiOracleModalOpen(true)}
							type="button"
						>
							<Sparkles aria-hidden="true" size={16} />
							Extract Tags (OppaiOracle)
						</button>
						<button
							class="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-teal-700"
							onClick={() => setIsCharacterCropModalOpen(true)}
							type="button"
						>
							<Scan aria-hidden="true" size={16} />
							Detect &amp; Crop Characters
						</button>
						<button
							class="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
							disabled={isExtractingCcip() || isCcipJobPending()}
							onClick={handleCcipExtraction}
							type="button"
						>
							<Binary aria-hidden="true" size={16} />
							{ccipActionLabel()}
						</button>
						<Show when={ccipStatus() === "ready"}>
							<button
								class="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 font-medium text-sm transition-colors hover:bg-gray-100"
								onClick={handleFindSimilar}
								type="button"
							>
								<ScanSearch aria-hidden="true" size={16} />
								Find Similar
							</button>
						</Show>
					</div>
				}
				when={props.variant === "v2"}
			>
				<div class="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
					<Button
						class="h-10 min-w-32 flex-1 md:h-9 md:flex-none"
						onClick={() => setIsAiTaggingModalOpen(true)}
						size="sm"
					>
						<Sparkles aria-hidden="true" size={15} />
						Extract tags
					</Button>
					<Button
						class="h-10 min-w-32 flex-1 md:h-9 md:flex-none"
						disabled={ccipStatus() !== "ready"}
						onClick={handleFindSimilar}
						size="sm"
						title={
							ccipStatus() === "ready"
								? undefined
								: "CCIP vector is required before similar search"
						}
						variant="outline"
					>
						<ScanSearch aria-hidden="true" size={15} />
						Find similar
					</Button>
					<Popover placement="bottom-end">
						<PopoverTrigger class="flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-white px-3 font-medium text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-9 md:flex-none">
							More actions
							<ChevronDown aria-hidden="true" size={14} />
						</PopoverTrigger>
						<PopoverContent class="v2-theme w-64 space-y-1 p-1.5 shadow-xl">
							<Button
								class="h-9 w-full justify-start px-2"
								onClick={() => setIsOppaiOracleModalOpen(true)}
								size="sm"
								variant="ghost"
							>
								<Sparkles aria-hidden="true" size={14} />
								Extract tags (OppaiOracle)
							</Button>
							<Button
								class="h-9 w-full justify-start px-2"
								onClick={() => setIsCharacterCropModalOpen(true)}
								size="sm"
								variant="ghost"
							>
								<Scan aria-hidden="true" size={14} />
								Detect &amp; crop characters
							</Button>
							<Button
								class="h-9 w-full justify-start px-2"
								disabled={isExtractingCcip() || isCcipJobPending()}
								onClick={handleCcipExtraction}
								size="sm"
								variant="ghost"
							>
								<Binary aria-hidden="true" size={14} />
								{ccipActionLabel()}
							</Button>
							<p
								aria-live="polite"
								class="px-2 py-1 text-[11px] text-[var(--v2-text-muted)]"
							>
								CCIP status: {ccipStatus()}
							</p>
						</PopoverContent>
					</Popover>
				</div>
			</Show>

			<AiTaggingModal
				isOpen={isAiTaggingModalOpen()}
				mediaId={props.media.id}
				mediaSourceId={props.media.mediaSourceId}
				onClose={() => setIsAiTaggingModalOpen(false)}
				onSuccess={props.onUpdate}
			/>
			<OppaiOracleModal
				isOpen={isOppaiOracleModalOpen()}
				mediaId={props.media.id}
				mediaSourceId={props.media.mediaSourceId}
				onClose={() => setIsOppaiOracleModalOpen(false)}
			/>
			<CharacterCropModal
				isOpen={isCharacterCropModalOpen()}
				media={props.media}
				onClose={() => setIsCharacterCropModalOpen(false)}
			/>
		</>
	);
}

export function MediaSidebar(props: MediaSidebarProps) {
	const queryClient = useQueryClient();
	const tags = createMemo(() => props.media.tags || []);

	// Description editing state
	const [isEditingDescription, setIsEditingDescription] = createSignal(false);
	const [descriptionValue, setDescriptionValue] = createSignal(
		props.media.description || "",
	);
	const descriptionDirty = () =>
		props.variant === "v2" &&
		isEditingDescription() &&
		descriptionValue() !== (props.media.description ?? "");
	const navigationBlocker = useBlocker({
		shouldBlockFn: descriptionDirty,
		enableBeforeUnload: descriptionDirty,
		withResolver: true,
	});

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
		<aside
			class={
				props.variant === "v2"
					? "min-w-0 divide-y divide-[var(--v2-border)] bg-[var(--v2-surface-subtle)] px-4 pb-6 lg:h-full lg:overflow-y-auto lg:overscroll-contain [&>div]:py-4 [scrollbar-gutter:stable]"
					: "min-w-0 space-y-4 rounded-lg border bg-gray-50 p-3 sm:p-4 lg:h-full lg:overflow-y-auto lg:overscroll-contain"
			}
		>
			<Show when={props.variant !== "v2"}>
				<div>
					<h1 class="font-bold text-xl break-all">{props.media.fileName}</h1>
					<p class="text-muted-foreground text-sm break-all">
						{props.media.filePath}
					</p>
				</div>
			</Show>

			<Show when={props.variant !== "v2"}>
				<MediaActions
					media={props.media}
					onUpdate={props.onUpdate}
					variant={props.variant}
				/>
			</Show>

			<div class="space-y-2">
				<h2 class="font-semibold text-lg">
					{props.variant === "v2" ? "File information" : "Details"}
				</h2>
				<dl
					class={
						props.variant === "v2"
							? "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-sm"
							: "grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2"
					}
				>
					<dt class="font-medium text-muted-foreground">Resolution</dt>
					<dd class="text-foreground">
						{props.media.width} x {props.media.height}
					</dd>
					<dt class="font-medium text-muted-foreground">File Size</dt>
					<dd class="text-foreground">
						{props.media.fileSize ? formatBytes(props.media.fileSize) : "N/A"}
					</dd>
					<Show when={props.variant === "v2"}>
						<dt class="font-medium text-muted-foreground">Path</dt>
						<dd class="min-w-0 max-w-52 break-all text-right text-foreground text-xs">
							{props.media.filePath}
						</dd>
					</Show>
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
				<Show when={props.variant === "v2"}>
					<h2 class="font-semibold text-lg">Relations</h2>
				</Show>
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
