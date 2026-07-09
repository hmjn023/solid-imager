import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { DuplicateGroup } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import { createQuery, type QueryClient } from "@tanstack/solid-query";
import {
	type Accessor,
	createEffect,
	createSignal,
	type Setter,
} from "solid-js";
import { prefetchQueryOnClient } from "../query-options";
import { type QueryUiState, toQueryUiState } from "../query-state";
import { toast } from "../toast";

export type ManagerEntityType =
	| "projects"
	| "ips"
	| "characters"
	| "tagging"
	| "vectors"
	| "duplicates";
export type ManagerEntity = Project | Ip | Character;

export type ManagerFormData = {
	name: string;
	description: string;
	ipIds?: string[];
};

export type StartBatchTaggingResult = {
	success: boolean;
	jobId?: string;
	message: string;
};

export type ManagerPageQueries = {
	projects: Accessor<Project[] | undefined>;
	ips: Accessor<Ip[] | undefined>;
	characters: Accessor<Character[] | undefined>;
	sources: Accessor<SafeMediaSource[] | undefined>;
};

export type ManagerPageActions = {
	createProject: (data: ManagerFormData) => Promise<unknown>;
	updateProject: (
		id: string,
		data: Partial<ManagerFormData>,
	) => Promise<unknown>;
	deleteProject: (id: string) => Promise<unknown>;
	createIp: (data: ManagerFormData) => Promise<unknown>;
	updateIp: (id: string, data: Partial<ManagerFormData>) => Promise<unknown>;
	deleteIp: (id: string) => Promise<unknown>;
	createCharacter: (data: ManagerFormData) => Promise<unknown>;
	updateCharacter: (
		id: string,
		data: Partial<ManagerFormData>,
	) => Promise<unknown>;
	deleteCharacter: (id: string) => Promise<unknown>;
	scanBatchTaggingTargets: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<{ count: number }>;
	startBatchTagging: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<StartBatchTaggingResult>;
	scanBatchCcipTargets: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<{ count: number }>;
	startBatchCcipExtraction: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<StartBatchTaggingResult>;
	findDuplicateMedia: (
		mediaSourceId?: string,
	) => Promise<{ groups: DuplicateGroup[] }>;
	bulkDeleteMedia: (sourceId: string, mediaIds: string[]) => Promise<unknown>;
	invalidate: (
		entityType: Exclude<ManagerEntityType, "tagging" | "vectors">,
	) => void;
};

export type ManagerPageMutationActions = Omit<ManagerPageActions, "invalidate">;

export type ManagerPageQueryOptions = {
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	projects: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	ips: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	characters: () => any;
	// biome-ignore lint/suspicious/noExplicitAny: library type mismatch between oRPC and solid-query
	sources: () => any;
};

export type UseManagerPageOptions = {
	queryClient: QueryClient;
	queryOptions: ManagerPageQueryOptions;
	actions: ManagerPageMutationActions;
	useBatchJobEvents?: (
		activeJobId: Accessor<string | null>,
		handlers: ManagerJobHandlers,
	) => void;
	onBatchTaggingStart?: (result: StartBatchTaggingResult) => void;
};

export function prefetchManagerPageQueries(
	queryClient: QueryClient,
	queryOptions: ManagerPageQueryOptions,
): void {
	prefetchQueryOnClient(() =>
		queryClient.prefetchQuery(queryOptions.projects()),
	);
	prefetchQueryOnClient(() => queryClient.prefetchQuery(queryOptions.ips()));
	prefetchQueryOnClient(() =>
		queryClient.prefetchQuery(queryOptions.characters()),
	);
	prefetchQueryOnClient(() =>
		queryClient.prefetchQuery(queryOptions.sources()),
	);
}

export type ManagerJobHandlers = {
	handleJobProgress: (event: JobProgressEvent) => void;
	handleJobCompleted: (event: JobCompletedEvent) => void;
	handleJobFailed: (event: JobFailedEvent) => void;
};

export type UseManagerPageResult = {
	activeTab: Accessor<ManagerEntityType>;
	setActiveTab: Setter<ManagerEntityType>;
	isDialogOpen: Accessor<boolean>;
	setIsDialogOpen: Setter<boolean>;
	isDeleteDialogOpen: Accessor<boolean>;
	setIsDeleteDialogOpen: Setter<boolean>;
	editingItem: Accessor<ManagerEntity | null>;
	itemToDelete: Accessor<ManagerEntity | null>;
	setItemToDelete: Setter<ManagerEntity | null>;
	formData: Accessor<ManagerFormData>;
	setFormData: Setter<ManagerFormData>;
	selectedSourceId: Accessor<string | undefined>;
	setSelectedSourceId: Setter<string | undefined>;
	forceRetag: Accessor<boolean>;
	setForceRetag: Setter<boolean>;
	taggingStatus: Accessor<string | null>;
	jobProgress: Accessor<JobProgressEvent | null>;
	activeJobId: Accessor<string | null>;
	sources: Accessor<SafeMediaSource[]>;
	ips: Accessor<Ip[]>;
	getActiveItems: Accessor<ManagerEntity[]>;
	queryStates: Accessor<{
		projects: QueryUiState<Project[]>;
		ips: QueryUiState<Ip[]>;
		characters: QueryUiState<Character[]>;
		sources: QueryUiState<SafeMediaSource[]>;
	}>;
	openCreateDialog: () => void;
	openEditDialog: (item: ManagerEntity) => void;
	handleSave: () => Promise<void>;
	handleConfirmDelete: () => Promise<void>;
	handleScan: () => Promise<void>;
	handleStartBatchTagging: () => Promise<void>;
	handleStartBatchCcipExtraction: () => Promise<void>;
	jobHandlers: ManagerJobHandlers;
	// Duplicates tab
	duplicateSourceId: Accessor<string | undefined>;
	setDuplicateSourceId: Setter<string | undefined>;
	duplicateGroups: Accessor<DuplicateGroup[]>;
	keepIds: Accessor<Set<string>>;
	duplicateStatus: Accessor<string | null>;
	isDuplicateDeleteDialogOpen: Accessor<boolean>;
	setIsDuplicateDeleteDialogOpen: Setter<boolean>;
	duplicatesToDelete: Accessor<
		{ sourceId: string; mediaId: string; fileName: string }[]
	>;
	handleScanDuplicates: () => Promise<void>;
	handleDeleteDuplicates: () => Promise<void>;
	handleConfirmDeleteDuplicates: () => Promise<void>;
	setKeepForGroup: (groupId: string, mediaId: string) => void;
	selectKeepOldest: () => void;
	selectKeepLargest: () => void;
	deleteCount: Accessor<number>;
};

function isCharacter(item: ManagerEntity): item is Character {
	return "ips" in item;
}

function resetForm(setFormData: Setter<ManagerFormData>) {
	setFormData({
		name: "",
		description: "",
		ipIds: [],
	});
}

function activeCrudTab(
	activeTab: ManagerEntityType,
): Exclude<ManagerEntityType, "tagging" | "vectors" | "duplicates"> | null {
	return activeTab === "tagging" ||
		activeTab === "vectors" ||
		activeTab === "duplicates"
		? null
		: activeTab;
}

export function useManagerPage(
	options: UseManagerPageOptions,
): UseManagerPageResult {
	const {
		actions,
		queryClient,
		queryOptions,
		useBatchJobEvents,
		onBatchTaggingStart,
	} = options;
	const projects = createQuery<Project[]>(() => queryOptions.projects());
	const ipsQuery = createQuery<Ip[]>(() => queryOptions.ips());
	const characters = createQuery<Character[]>(() => queryOptions.characters());
	const sourcesQuery = createQuery<SafeMediaSource[]>(() =>
		queryOptions.sources(),
	);

	const queries: ManagerPageQueries = {
		projects: () => projects.data,
		ips: () => ipsQuery.data,
		characters: () => characters.data,
		sources: () => sourcesQuery.data,
	};

	const [activeTab, setActiveTab] = createSignal<ManagerEntityType>("projects");
	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [editingItem, setEditingItem] = createSignal<ManagerEntity | null>(
		null,
	);
	const [itemToDelete, setItemToDelete] = createSignal<ManagerEntity | null>(
		null,
	);
	const [formData, setFormData] = createSignal<ManagerFormData>({
		name: "",
		description: "",
		ipIds: [],
	});

	const [selectedSourceId, setSelectedSourceId] = createSignal<
		string | undefined
	>(undefined);
	const [forceRetag, setForceRetag] = createSignal(false);
	const [taggingStatus, setTaggingStatus] = createSignal<string | null>(null);
	const [jobProgress, setJobProgress] = createSignal<JobProgressEvent | null>(
		null,
	);
	const [activeJobId, setActiveJobId] = createSignal<string | null>(null);

	createEffect(() => {
		const tab = activeTab();
		if (tab !== "tagging" && tab !== "vectors") {
			return;
		}

		setTaggingStatus(null);
	});

	// Duplicates state
	const [duplicateSourceId, setDuplicateSourceId] = createSignal<
		string | undefined
	>(undefined);
	const [duplicateGroups, setDuplicateGroups] = createSignal<DuplicateGroup[]>(
		[],
	);
	const [keepIds, setKeepIds] = createSignal<Set<string>>(new Set());
	const [duplicateStatus, setDuplicateStatus] = createSignal<string | null>(
		null,
	);
	const [isDuplicateDeleteDialogOpen, setIsDuplicateDeleteDialogOpen] =
		createSignal(false);
	const [duplicatesToDelete, setDuplicatesToDelete] = createSignal<
		{ sourceId: string; mediaId: string; fileName: string }[]
	>([]);

	const sources = () => queries.sources() || [];
	const ips = () => queries.ips() || [];

	const getActiveItems = () => {
		switch (activeTab()) {
			case "projects":
				return queries.projects() || [];
			case "ips":
				return queries.ips() || [];
			case "characters":
				return queries.characters() || [];
			default:
				return [];
		}
	};

	const queryStates = () => ({
		projects: toQueryUiState(projects, {
			isEmpty: (data) => data.length === 0,
		}),
		ips: toQueryUiState(ipsQuery, {
			isEmpty: (data) => data.length === 0,
		}),
		characters: toQueryUiState(characters, {
			isEmpty: (data) => data.length === 0,
		}),
		sources: toQueryUiState(sourcesQuery, {
			isEmpty: (data) => data.length === 0,
		}),
	});

	const invalidateActive = () => {
		const tab = activeCrudTab(activeTab());
		if (tab) {
			const option = queryOptions[tab]();
			void queryClient.invalidateQueries({ queryKey: option.queryKey });
		}
	};

	const openCreateDialog = () => {
		setEditingItem(null);
		resetForm(setFormData);
		setIsDialogOpen(true);
	};

	const openEditDialog = (item: ManagerEntity) => {
		setEditingItem(item);
		setFormData({
			name: item.name,
			description: item.description || "",
			ipIds: isCharacter(item) ? item.ips.map((ip) => ip.id) : [],
		});
		setIsDialogOpen(true);
	};

	const handleCreate = async () => {
		const data = formData();
		try {
			if (activeTab() === "projects") {
				await actions.createProject(data);
			} else if (activeTab() === "ips") {
				await actions.createIp(data);
			} else if (activeTab() === "characters") {
				await actions.createCharacter(data);
			}

			invalidateActive();
			setIsDialogOpen(false);
			setEditingItem(null);
			resetForm(setFormData);
		} catch (error) {
			toast.error(`Failed to save: ${getErrorMessage(error)}`);
		}
	};

	const handleUpdate = async () => {
		const data = formData();
		const current = editingItem();
		if (!current) {
			return;
		}

		try {
			if (activeTab() === "projects") {
				await actions.updateProject(current.id, data);
			} else if (activeTab() === "ips") {
				await actions.updateIp(current.id, data);
			} else if (activeTab() === "characters") {
				await actions.updateCharacter(current.id, data);
			}

			invalidateActive();
			setIsDialogOpen(false);
			setEditingItem(null);
			resetForm(setFormData);
		} catch (error) {
			toast.error(`Failed to save: ${getErrorMessage(error)}`);
		}
	};

	const handleConfirmDelete = async () => {
		const item = itemToDelete();
		if (!item) {
			return;
		}

		try {
			if (activeTab() === "projects") {
				await actions.deleteProject(item.id);
			} else if (activeTab() === "ips") {
				await actions.deleteIp(item.id);
			} else if (activeTab() === "characters") {
				await actions.deleteCharacter(item.id);
			}
			invalidateActive();
			toast.success("Deleted successfully");
		} catch (error) {
			toast.error(`Failed to delete: ${getErrorMessage(error)}`);
		} finally {
			setIsDeleteDialogOpen(false);
			setItemToDelete(null);
		}
	};

	const handleScan = async () => {
		const scanTab = activeTab();
		if (scanTab !== "tagging" && scanTab !== "vectors") {
			return;
		}

		try {
			setTaggingStatus("Scanning...");
			const result =
				scanTab === "vectors"
					? await actions.scanBatchCcipTargets({
							force: forceRetag(),
							mediaSourceId: selectedSourceId(),
						})
					: await actions.scanBatchTaggingTargets({
							force: forceRetag(),
							mediaSourceId: selectedSourceId(),
						});
			if (activeTab() !== scanTab) {
				return;
			}
			setTaggingStatus(`${result.count} items found.`);
		} catch (error) {
			if (activeTab() !== scanTab) {
				return;
			}
			toast.error(`Error: ${getErrorMessage(error)}`);
			setTaggingStatus(`Error during scan: ${getErrorMessage(error)}`);
		}
	};

	const handleStartBatchCcipExtraction = async () => {
		try {
			setTaggingStatus("Starting...");
			setJobProgress(null);
			const result = await actions.startBatchCcipExtraction({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
			});
			if (result.success && result.jobId) {
				toast.success(result.message);
				setTaggingStatus("Batch CCIP extraction in progress...");
				setActiveJobId(result.jobId);
			} else {
				toast.error("Failed to start batch CCIP extraction.");
				setTaggingStatus("Failed to start batch CCIP extraction.");
			}
		} catch (error) {
			toast.error(`Error: ${getErrorMessage(error)}`);
			setTaggingStatus(`Error: ${getErrorMessage(error)}`);
		}
	};

	const handleStartBatchTagging = async () => {
		try {
			setTaggingStatus("Starting...");
			setJobProgress(null);
			const result = await actions.startBatchTagging({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
			});
			if (result.success && result.jobId) {
				onBatchTaggingStart?.(result);
				toast.success(result.message);
				setTaggingStatus("Batch tagging in progress...");
				setActiveJobId(result.jobId);
			} else {
				toast.error("Failed to start batch tagging.");
				setTaggingStatus("Failed to start batch tagging.");
			}
		} catch (error) {
			toast.error(`Error: ${getErrorMessage(error)}`);
			setTaggingStatus(`Error: ${getErrorMessage(error)}`);
		}
	};

	// --- Duplicates ---

	const setKeepForGroup = (_groupId: string, mediaId: string) => {
		setKeepIds((prev) => {
			const next = new Set(prev);
			// Remove all items from the same group (identified by having the same media items)
			const groups = duplicateGroups();
			for (const group of groups) {
				for (const item of group.media) {
					if (item.id === mediaId) {
						// Remove other items from this group
						for (const otherItem of group.media) {
							next.delete(otherItem.id);
						}
						next.add(mediaId);
						break;
					}
				}
			}
			return next;
		});
	};

	const selectKeepOldest = () => {
		const newKeep = new Set<string>();
		for (const group of duplicateGroups()) {
			const sorted = [...group.media].sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			);
			newKeep.add(sorted[0].id);
		}
		setKeepIds(newKeep);
	};

	const selectKeepLargest = () => {
		const newKeep = new Set<string>();
		for (const group of duplicateGroups()) {
			const sorted = [...group.media].sort(
				(a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0),
			);
			newKeep.add(sorted[0].id);
		}
		setKeepIds(newKeep);
	};

	const handleScanDuplicates = async () => {
		try {
			setDuplicateStatus("Scanning...");
			setDuplicateGroups([]);
			const result = await actions.findDuplicateMedia(duplicateSourceId());
			setDuplicateGroups(result.groups);
			// Auto-select oldest in each group
			const newKeep = new Set<string>();
			for (const group of result.groups) {
				const sorted = [...group.media].sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
				);
				newKeep.add(sorted[0].id);
			}
			setKeepIds(newKeep);
			const dupCount = result.groups.reduce(
				(sum, g) => sum + g.media.length - 1,
				0,
			);
			setDuplicateStatus(
				`${result.groups.length} groups found (${dupCount} duplicates).`,
			);
		} catch (error) {
			toast.error(`Error: ${getErrorMessage(error)}`);
			setDuplicateStatus(`Error: ${getErrorMessage(error)}`);
		}
	};

	const handleDeleteDuplicates = async () => {
		const groups = duplicateGroups();
		const keepSet = keepIds();
		const toDelete: { sourceId: string; mediaId: string; fileName: string }[] =
			[];
		for (const group of groups) {
			for (const item of group.media) {
				if (!keepSet.has(item.id)) {
					toDelete.push({
						sourceId: item.mediaSourceId,
						mediaId: item.id,
						fileName: item.fileName,
					});
				}
			}
		}
		if (toDelete.length === 0) {
			toast.error("No duplicates selected for deletion");
			return;
		}
		setDuplicatesToDelete(toDelete);
		setIsDuplicateDeleteDialogOpen(true);
	};

	const handleConfirmDeleteDuplicates = async () => {
		const toDelete = duplicatesToDelete();
		if (toDelete.length === 0) {
			return;
		}
		let deleted = 0;
		let failed = 0;
		const deletedIds = new Set<string>();

		// Group by sourceId to perform bulk deletion
		const groupsBySource = new Map<string, string[]>();
		for (const item of toDelete) {
			if (!groupsBySource.has(item.sourceId)) {
				groupsBySource.set(item.sourceId, []);
			}
			groupsBySource.get(item.sourceId)?.push(item.mediaId);
		}

		try {
			for (const [sourceId, mediaIds] of groupsBySource.entries()) {
				try {
					await actions.bulkDeleteMedia(sourceId, mediaIds);
					deleted += mediaIds.length;
					for (const id of mediaIds) {
						deletedIds.add(id);
					}
				} catch {
					failed += mediaIds.length;
				}
			}
		} finally {
			setIsDuplicateDeleteDialogOpen(false);
			setDuplicatesToDelete([]);
			if (failed === 0) {
				setDuplicateGroups([]);
				setKeepIds(new Set<string>());
				setDuplicateStatus(null);
				toast.success(`Deleted ${deleted} duplicate(s)`);
			} else {
				// Remove successfully deleted items from groups
				setDuplicateGroups((prev) =>
					prev
						.map((group) => ({
							...group,
							media: group.media.filter((m) => !deletedIds.has(m.id)),
						}))
						.filter((group) => group.media.length >= 2),
				);
				setKeepIds((prev) => {
					const next = new Set(prev);
					for (const id of deletedIds) next.delete(id);
					return next;
				});
				if (deleted > 0) {
					toast.error(
						`Deleted ${deleted}, failed ${failed}. Remaining duplicates are still shown.`,
					);
				} else {
					toast.error(`Failed to delete: all ${failed} items failed.`);
				}
			}
		}
	};

	// --- End Duplicates ---

	const deleteCount = () => {
		const groups = duplicateGroups();
		const keep = keepIds();
		let count = 0;
		for (const g of groups) {
			for (const m of g.media) {
				if (!keep.has(m.id)) count++;
			}
		}
		return count;
	};

	const handleJobProgress = (event: JobProgressEvent) => {
		setJobProgress(event);
		setTaggingStatus(`Processing: ${event.processed} / ${event.total}.`);
	};

	const handleJobCompleted = (event: JobCompletedEvent) => {
		toast.success(event.message || "Batch operation completed!");
		setTaggingStatus("Batch operation completed successfully.");
		setActiveJobId(null);
		setJobProgress(null);
	};

	const handleJobFailed = (event: JobFailedEvent) => {
		const message = event.error || "unknown error";
		toast.error(`Job failed: ${message}`);
		setTaggingStatus(`Job failed: ${message}`);
		setActiveJobId(null);
		setJobProgress(null);
	};

	const jobHandlers: ManagerJobHandlers = {
		handleJobProgress,
		handleJobCompleted,
		handleJobFailed,
	};

	useBatchJobEvents?.(activeJobId, jobHandlers);

	return {
		activeTab,
		setActiveTab,
		isDialogOpen,
		setIsDialogOpen,
		isDeleteDialogOpen,
		setIsDeleteDialogOpen,
		editingItem,
		itemToDelete,
		setItemToDelete,
		formData,
		setFormData,
		selectedSourceId,
		setSelectedSourceId,
		forceRetag,
		setForceRetag,
		taggingStatus,
		jobProgress,
		activeJobId,
		sources,
		ips,
		getActiveItems,
		queryStates,
		openCreateDialog,
		openEditDialog,
		handleSave: () => (editingItem() ? handleUpdate() : handleCreate()),
		handleConfirmDelete,
		handleScan,
		handleStartBatchTagging,
		handleStartBatchCcipExtraction,
		jobHandlers,
		// Duplicates
		duplicateSourceId,
		setDuplicateSourceId,
		duplicateGroups,
		keepIds,
		duplicateStatus,
		isDuplicateDeleteDialogOpen,
		setIsDuplicateDeleteDialogOpen,
		duplicatesToDelete,
		handleScanDuplicates,
		handleDeleteDuplicates,
		setKeepForGroup,
		selectKeepOldest,
		selectKeepLargest,
		handleConfirmDeleteDuplicates,
		deleteCount,
	};
}
