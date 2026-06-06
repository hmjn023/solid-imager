import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type {
	JobCompletedEvent,
	JobFailedEvent,
	JobProgressEvent,
} from "@solid-imager/core/domain/sources/events";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { createQuery, type QueryClient } from "@tanstack/solid-query";
import {
	type Accessor,
	createEffect,
	createSignal,
	type Setter,
} from "solid-js";
import type { buildCharactersQueryOptions } from "../query-options/characters-query";
import type { buildIpsQueryOptions } from "../query-options/ips-query";
import type { buildProjectsQueryOptions } from "../query-options/projects-query";
import type { buildSourcesQueryOptions } from "../query-options/sources-query";
import { toast } from "../toast";

export type ManagerEntityType = "projects" | "ips" | "characters" | "tagging";
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
	}) => Promise<Media[]>;
	startBatchTaggingWithIds: (input: {
		force: boolean;
		mediaSourceId?: string;
		mediaIds: string[];
	}) => Promise<StartBatchTaggingResult>;
	invalidate: (entityType: Exclude<ManagerEntityType, "tagging">) => void;
};

export type ManagerPageMutationActions = Omit<ManagerPageActions, "invalidate">;

export type ManagerPageQueryOptions = {
	projects: () => ReturnType<typeof buildProjectsQueryOptions>;
	ips: () => ReturnType<typeof buildIpsQueryOptions>;
	characters: () => ReturnType<typeof buildCharactersQueryOptions>;
	sources: () => ReturnType<typeof buildSourcesQueryOptions>;
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
	itemsPerPage?: number;
};

export async function prefetchManagerPageQueries(
	queryClient: QueryClient,
	queryOptions: ManagerPageQueryOptions,
) {
	await Promise.all([
		queryClient.ensureQueryData(queryOptions.projects()),
		queryClient.ensureQueryData(queryOptions.ips()),
		queryClient.ensureQueryData(queryOptions.characters()),
		queryClient.ensureQueryData(queryOptions.sources()),
	]);
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
	scannedMedia: Accessor<Media[]>;
	selectedMedia: Accessor<Set<string>>;
	jobProgress: Accessor<JobProgressEvent | null>;
	activeJobId: Accessor<string | null>;
	currentPage: Accessor<number>;
	setCurrentPage: Setter<number>;
	itemsPerPage: number;
	totalPages: Accessor<number>;
	paginatedMedia: Accessor<Media[]>;
	sources: Accessor<SafeMediaSource[]>;
	ips: Accessor<Ip[]>;
	getActiveItems: Accessor<ManagerEntity[]>;
	openCreateDialog: () => void;
	openEditDialog: (item: ManagerEntity) => void;
	handleSave: () => Promise<void>;
	handleConfirmDelete: () => Promise<void>;
	handleScan: () => Promise<void>;
	handleStartBatchTagging: () => Promise<void>;
	toggleMediaSelection: (mediaId: string) => void;
	toggleSelectAll: () => void;
	jobHandlers: ManagerJobHandlers;
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
): Exclude<ManagerEntityType, "tagging"> | null {
	return activeTab === "tagging" ? null : activeTab;
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
		itemsPerPage = 50,
	} = options;
	const projects = createQuery(() => queryOptions.projects());
	const ipsQuery = createQuery(() => queryOptions.ips());
	const characters = createQuery(() => queryOptions.characters());
	const sourcesQuery = createQuery(() => queryOptions.sources());

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
	const [scannedMedia, setScannedMedia] = createSignal<Media[]>([]);
	const [selectedMedia, setSelectedMedia] = createSignal<Set<string>>(
		new Set(),
	);
	const [jobProgress, setJobProgress] = createSignal<JobProgressEvent | null>(
		null,
	);
	const [activeJobId, setActiveJobId] = createSignal<string | null>(null);
	const [currentPage, setCurrentPage] = createSignal(1);

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

	const totalPages = () => Math.ceil(scannedMedia().length / itemsPerPage);

	const paginatedMedia = () => {
		const start = (currentPage() - 1) * itemsPerPage;
		return scannedMedia().slice(start, start + itemsPerPage);
	};

	createEffect(() => {
		if (scannedMedia().length > 0) {
			setCurrentPage(1);
		}
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
			toast.error(`Failed to save: ${(error as Error).message}`);
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
			toast.error(`Failed to save: ${(error as Error).message}`);
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
			toast.error(`Failed to delete: ${(error as Error).message}`);
		} finally {
			setIsDeleteDialogOpen(false);
			setItemToDelete(null);
		}
	};

	const handleScan = async () => {
		try {
			setTaggingStatus("Scanning...");
			setScannedMedia([]);
			const result = await actions.scanBatchTaggingTargets({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
			});
			setScannedMedia(result);
			setSelectedMedia(new Set(result.map((item) => item.id)));
			setTaggingStatus(`${result.length} items found.`);
		} catch (error) {
			toast.error(`Error: ${(error as Error).message}`);
			setTaggingStatus(`Error during scan: ${(error as Error).message}`);
		}
	};

	const handleStartBatchTagging = async () => {
		if (selectedMedia().size === 0) {
			toast.error("No media selected");
			return;
		}

		try {
			setTaggingStatus("Starting...");
			setJobProgress(null);
			const result = await actions.startBatchTaggingWithIds({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
				mediaIds: Array.from(selectedMedia()),
			});
			if (result.success && result.jobId) {
				onBatchTaggingStart?.(result);
				toast.success(result.message);
				setTaggingStatus("Batch tagging in progress...");
				setActiveJobId(result.jobId);
				setScannedMedia([]);
				setSelectedMedia(new Set<string>());
			} else {
				toast.error("Failed to start batch tagging.");
				setTaggingStatus("Failed to start batch tagging.");
			}
		} catch (error) {
			toast.error(`Error: ${(error as Error).message}`);
			setTaggingStatus(`Error: ${(error as Error).message}`);
		}
	};

	const toggleMediaSelection = (mediaId: string) => {
		setSelectedMedia((previous) => {
			const next = new Set(previous);
			if (next.has(mediaId)) {
				next.delete(mediaId);
			} else {
				next.add(mediaId);
			}
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (selectedMedia().size === scannedMedia().length) {
			setSelectedMedia(new Set<string>());
		} else {
			setSelectedMedia(new Set(scannedMedia().map((item) => item.id)));
		}
	};

	const handleJobProgress = (event: JobProgressEvent) => {
		setJobProgress(event);
		setTaggingStatus(`Processing: ${event.processed} / ${event.total} tagged.`);
	};

	const handleJobCompleted = (event: JobCompletedEvent) => {
		toast.success(event.message || "Batch tagging completed!");
		setTaggingStatus("Batch tagging completed successfully.");
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
		scannedMedia,
		selectedMedia,
		jobProgress,
		activeJobId,
		currentPage,
		setCurrentPage,
		itemsPerPage,
		totalPages,
		paginatedMedia,
		sources,
		ips,
		getActiveItems,
		openCreateDialog,
		openEditDialog,
		handleSave: () => (editingItem() ? handleUpdate() : handleCreate()),
		handleConfirmDelete,
		handleScan,
		handleStartBatchTagging,
		toggleMediaSelection,
		toggleSelectAll,
		jobHandlers,
	};
}
