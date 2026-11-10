import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { JobDto, JobStatus } from "@solid-imager/core/jobs";
import type { DuplicateGroup } from "@solid-imager/core/media";
import type { Project } from "@solid-imager/core/projects";
import type { SimilarityModel } from "@solid-imager/core/search";
import type { JobProgressEvent } from "@solid-imager/core/events";
import type { SafeMediaSource } from "@solid-imager/core/sources";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createQuery,
	type QueryClient,
	type QueryOptions,
} from "@tanstack/solid-query";
import {
	type Accessor,
	createEffect,
	createSignal,
	onMount,
	onCleanup,
	type Setter,
} from "solid-js";
import { isServer } from "solid-js/web";
import { prefetchQueryOnClient } from "../query-options";
import { type QueryUiState, toQueryUiState } from "../query-state";
import { toast } from "../toast";
import type {
	ManagerJobHandlers,
	UseBatchJobEventsOptions,
} from "./batch-job-events.types";
import { jobsQueryKeys } from "../query-options/jobs-query";
import {
	createManagerBatchState,
	type ManagerBatchContext,
} from "./manager-batch-state";
import { createManagerDuplicatesState } from "./manager-duplicates-state";
import {
	managerSessionStorage,
	forgetManagerBatchRun,
	readManagerBatchRun,
	saveManagerBatchRun,
} from "./manager-batch-run";

export type ManagerEntityType =
	| "projects"
	| "ips"
	| "characters"
	| "tagging"
	| "vectors"
	| "thumbnails"
	| "duplicates";
export type ManagerEntity = Project | Ip | Character;

export type ManagerFormData = {
	name: string;
	description: string;
	ipIds?: string[];
};

export type StartBatchJobResult = {
	success: boolean;
	jobId?: string;
	message: string;
};

export type StartBatchTaggingResult = StartBatchJobResult;

export type ManagerPageQueries = {
	projects: Accessor<Project[] | undefined>;
	ips: Accessor<Ip[] | undefined>;
	characters: Accessor<Character[] | undefined>;
	sources: Accessor<SafeMediaSource[] | undefined>;
};

export type ManagerPageActions = {
	getActiveBatches: () => Promise<JobDto[]>;
	getJob: (jobId: string) => Promise<JobDto>;
	scanBatchEmbeddingTargets?: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<{ count: number }>;
	startBatchEmbeddingExtraction?: (input: {
		force: boolean;
		mediaSourceId?: string;
	}) => Promise<StartBatchTaggingResult>;
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
	startThumbnailWarmup: (input: {
		mediaSourceId: string;
		missingOnly: true;
		size: 256;
	}) => Promise<StartBatchJobResult>;
	findDuplicateMedia: (
		mediaSourceId?: string,
	) => Promise<{ groups: DuplicateGroup[] }>;
	bulkDeleteMedia: (sourceId: string, mediaIds: string[]) => Promise<unknown>;
	invalidate: (entityType: "projects" | "ips" | "characters") => void;
};

export type ManagerPageMutationActions = Omit<ManagerPageActions, "invalidate">;

type QueryOptionsFor<TData> = QueryOptions<TData> & {
	initialData?: undefined;
};

export type ManagerPageQueryOptions = {
	projects: () => QueryOptionsFor<Project[]>;
	ips: () => QueryOptionsFor<Ip[]>;
	characters: () => QueryOptionsFor<Character[]>;
	sources: () => QueryOptionsFor<SafeMediaSource[]>;
};

export type UseManagerPageOptions = {
	queryClient: QueryClient;
	queryOptions: ManagerPageQueryOptions;
	actions: ManagerPageMutationActions;
	useBatchJobEvents?: (
		activeJobId: Accessor<string | null>,
		handlers: ManagerJobHandlers,
		options?: UseBatchJobEventsOptions,
	) => void;
	onBatchTaggingStart?: (result: StartBatchTaggingResult) => void;
};

export function prefetchManagerPageQueries(
	queryClient: QueryClient,
	queryOptions: ManagerPageQueryOptions,
): void {
	prefetchQueryOnClient(() =>
		queryClient.query(queryOptions.projects()).then(
			() => undefined,
			() => undefined,
		),
	);
	prefetchQueryOnClient(() =>
		queryClient.query(queryOptions.ips()).then(
			() => undefined,
			() => undefined,
		),
	);
	prefetchQueryOnClient(() =>
		queryClient.query(queryOptions.characters()).then(
			() => undefined,
			() => undefined,
		),
	);
	prefetchQueryOnClient(() =>
		queryClient.query(queryOptions.sources()).then(
			() => undefined,
			() => undefined,
		),
	);
}

export type UseManagerPageResult = {
	vectorModel: Accessor<SimilarityModel>;
	setVectorModel: Setter<SimilarityModel>;
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
	activeBatches: Accessor<JobDto[]>;
	activeBatchesFailed: Accessor<boolean>;
	retryActiveBatches: () => void;
	jobProgress: Accessor<(JobProgressEvent & { failed?: number }) | null>;
	jobStatus: Accessor<JobStatus | null>;
	activeJobId: Accessor<string | null>;
	batchPendingAction: Accessor<"scan" | "start" | null>;
	batchDisplayKind: Accessor<"run" | "scan" | "start" | null>;
	displayedJobId: Accessor<string | null>;
	trackBatchJob: (job: JobDto) => void;
	sources: Accessor<SafeMediaSource[]>;
	ips: Accessor<Ip[]>;
	getActiveItems: Accessor<ManagerEntity[]>;
	queryStates: Accessor<{
		projects: QueryUiState<Project[]>;
		ips: QueryUiState<Ip[]>;
		characters: QueryUiState<Character[]>;
		sources: QueryUiState<SafeMediaSource[]>;
	}>;
	retryQueries: () => Promise<void>;
	openCreateDialog: () => void;
	openEditDialog: (item: ManagerEntity) => void;
	handleSave: () => Promise<void>;
	handleConfirmDelete: () => Promise<void>;
	handleScan: () => Promise<void>;
	handleStartBatchTagging: () => Promise<void>;
	handleStartBatchCcipExtraction: () => Promise<void>;
	handleStartThumbnailWarmup: () => Promise<void>;
	jobHandlers: ManagerJobHandlers;
	// Duplicates tab
	duplicateSourceId: Accessor<string | undefined>;
	setDuplicateSourceId: Setter<string | undefined>;
	duplicateGroups: Accessor<DuplicateGroup[]>;
	keepIds: Accessor<Set<string>>;
	duplicateStatus: Accessor<string | null>;
	isScanningDuplicates: Accessor<boolean>;
	isDeletingDuplicates: Accessor<boolean>;
	isDuplicateDeleteDialogOpen: Accessor<boolean>;
	setIsDuplicateDeleteDialogOpen: Setter<boolean>;
	duplicatesToDelete: Accessor<
		{
			sourceId: string;
			sourceName: string;
			mediaId: string;
			fileName: string;
		}[]
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
): Exclude<
	ManagerEntityType,
	"tagging" | "vectors" | "thumbnails" | "duplicates"
> | null {
	return activeTab === "tagging" ||
		activeTab === "vectors" ||
		activeTab === "thumbnails" ||
		activeTab === "duplicates"
		? null
		: activeTab;
}

/** Manages Manager actions and selections, restores the locally tracked job, and refreshes server batch snapshots on job events and reconnects. */
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
	const projects = createQuery<Project[]>(() => ({
		...queryOptions.projects(),
		enabled: !isServer,
	}));
	const ipsQuery = createQuery<Ip[]>(() => ({
		...queryOptions.ips(),
		enabled: !isServer,
	}));
	const characters = createQuery<Character[]>(() => ({
		...queryOptions.characters(),
		enabled: !isServer,
	}));
	const sourcesQuery = createQuery<SafeMediaSource[]>(() => ({
		...queryOptions.sources(),
		enabled: !isServer,
	}));

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
	function changeSelectedSourceId(): undefined;
	function changeSelectedSourceId<U extends string | undefined>(
		value: U | ((previous: string | undefined) => U),
	): U;
	function changeSelectedSourceId(
		value?: string | ((previous: string | undefined) => string | undefined),
	) {
		const next = setSelectedSourceId(value);
		batches.invalidateScans();
		return next;
	}
	const [forceRetag, setForceRetag] = createSignal(false);
	const [vectorModel, setVectorModel] = createSignal<SimilarityModel>(
		actions.startBatchEmbeddingExtraction ? "embeddinggemma2" : "ccip",
	);
	const batches = createManagerBatchState((run) => {
		const storage = managerSessionStorage();
		if (storage) saveManagerBatchRun(storage, run);
	});
	const activeJobId = batches.activeJobId;
	const trackedRun = batches.trackedRun;
	const batchDisplay = () => {
		const tab = activeTab();
		return tab === "tagging" || tab === "vectors" || tab === "thumbnails"
			? batches.display(tab)
			: null;
	};
	const batchPendingAction = () => {
		const tab = activeTab();
		return tab === "tagging" || tab === "vectors" || tab === "thumbnails"
			? batches.pending(tab)
			: null;
	};
	const jobStatus = () => batchDisplay()?.status ?? null;
	const jobProgress = () => {
		const display = batchDisplay();
		return display?.progress
			? { jobId: display.jobId ?? undefined, ...display.progress }
			: null;
	};
	const [batchReadError, setBatchReadError] = createSignal<string | null>(null);
	const taggingStatus = () =>
		batchDisplay()?.kind === "run" &&
		batchDisplay()?.jobId === trackedRun()?.jobId &&
		batchReadError()
			? batchReadError()
			: (batchDisplay()?.message ?? null);
	const activeBatches = createQuery(() => ({
		queryKey: ["jobs", "activeBatches"],
		queryFn: async () => {
			const versions = batches.readVersions();
			const jobs = await actions.getActiveBatches();
			for (const job of jobs) {
				const version = versions[job.id];
				if (version !== undefined) batches.acceptSnapshot(job, version);
			}
			return jobs;
		},
		enabled: !isServer,
	}));
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	let reading = false;
	let dirty = false;
	/** Coalesces job events into snapshot reads and schedules another read if an event arrives during a refresh. */
	function refreshActiveBatches() {
		dirty = true;
		if (reading || refreshTimer || disposed) return;
		refreshTimer = setTimeout(async () => {
			refreshTimer = undefined;
			reading = true;
			dirty = false;
			await activeBatches.refetch();
			reading = false;
			if (dirty) refreshActiveBatches();
		}, 250);
	}
	onCleanup(() => {
		disposed = true;
		clearTimeout(refreshTimer);
	});
	let trackedRefreshTimer: ReturnType<typeof setTimeout> | undefined;
	onCleanup(() => clearTimeout(trackedRefreshTimer));
	const trackedJob = createQuery<JobDto>(() => {
		const jobId = trackedRun()?.jobId;
		return {
			queryKey: jobsQueryKeys.detail(jobId ?? ""),
			queryFn: async () => {
				if (!jobId) throw new Error("No tracked batch");
				const version = batches.version(jobId);
				const job = await actions.getJob(jobId);
				if (batches.acceptSnapshot(job, version)) setBatchReadError(null);
				else if (
					batches.version(jobId) !== version &&
					!disposed &&
					trackedRun()?.jobId === jobId
				) {
					// The GET started before a newer SSE observation. Read again after
					// this query settles instead of letting its response regress the UI.
					clearTimeout(trackedRefreshTimer);
					trackedRefreshTimer = setTimeout(() => {
						if (!disposed) void trackedJob.refetch();
					}, 250);
				}
				return job;
			},
			enabled: !isServer && trackedRun() !== null,
			staleTime: 0,
		};
	});
	onMount(() => {
		const storage = managerSessionStorage();
		const run = storage ? readManagerBatchRun(storage) : null;
		if (!run) return;
		setActiveTab(run.tab);
		setSelectedSourceId(run.mediaSourceId);
		setVectorModel(run.vectorModel);
		setForceRetag(run.force);
		batches.restore(run);
	});

	createEffect(() => {
		const error = trackedJob.error;
		if (!error) return;
		if ("code" in error && error.code === "NOT_FOUND") {
			const storage = managerSessionStorage();
			if (storage) forgetManagerBatchRun(storage);
			batches.forget();
			setBatchReadError("The tracked batch no longer exists.");
			return;
		}
		setBatchReadError(
			`Unable to refresh batch progress: ${getErrorMessage(error)}.`,
		);
	});
	const duplicates = createManagerDuplicatesState({
		findDuplicateMedia: actions.findDuplicateMedia,
		bulkDeleteMedia: actions.bulkDeleteMedia,
		sourceName: (id) =>
			queries.sources()?.find((source) => source.id === id)?.name ?? id,
		success: (message) => toast.success(message),
		error: (message) => toast.error(message),
	});

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

	const retryQueries = async () => {
		await Promise.all([
			projects.refetch(),
			ipsQuery.refetch(),
			characters.refetch(),
			sourcesQuery.refetch(),
		]);
	};

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

	function batchContext(tab: ManagerBatchContext["tab"]): ManagerBatchContext {
		return {
			tab,
			vectorModel: vectorModel(),
			mediaSourceId: selectedSourceId(),
			force: tab === "thumbnails" ? false : forceRetag(),
		};
	}
	const handleScan = async () => {
		const tab = activeTab();
		if (tab !== "tagging" && tab !== "vectors") return;
		const request = batches.begin("scan", batchContext(tab));
		if (!request) return;
		const context = request.context;
		try {
			const scan =
				tab === "tagging"
					? actions.scanBatchTaggingTargets
					: context.vectorModel === "embeddinggemma2" &&
						  actions.scanBatchEmbeddingTargets
						? actions.scanBatchEmbeddingTargets
						: actions.scanBatchCcipTargets;
			const result = await scan({
				force: context.force,
				mediaSourceId: context.mediaSourceId,
			});
			batches.setRequestMessage(request, `${result.count} items found.`);
		} catch (error) {
			batches.setRequestMessage(
				request,
				`Error during scan: ${getErrorMessage(error)}`,
			);
			toast.error(`Error: ${getErrorMessage(error)}`);
		} finally {
			batches.finish(request);
		}
	};
	async function startBatch(
		context: ManagerBatchContext,
		start: () => Promise<StartBatchJobResult>,
	) {
		const request = batches.begin("start", context);
		if (!request) return;
		setBatchReadError(null);
		try {
			const result = await start();
			if (result.success && result.jobId) {
				batches.acceptStart(request, result.jobId);
				if (context.tab === "tagging") onBatchTaggingStart?.(result);
				toast.success(result.message);
			} else {
				const message = result.message || "Failed to start batch operation.";
				batches.setRequestMessage(request, message);
				if (result.success) toast.success(message);
				else toast.error(message);
			}
		} catch (error) {
			const message = `Error: ${getErrorMessage(error)}`;
			batches.setRequestMessage(request, message);
			toast.error(message);
		} finally {
			batches.finish(request);
		}
	}
	const handleStartBatchCcipExtraction = () => {
		const context = batchContext("vectors");
		return startBatch(context, () =>
			(context.vectorModel === "embeddinggemma2" &&
				actions.startBatchEmbeddingExtraction
				? actions.startBatchEmbeddingExtraction
				: actions.startBatchCcipExtraction)({
				force: context.force,
				mediaSourceId: context.mediaSourceId,
			}),
		);
	};
	const handleStartBatchTagging = () => {
		const context = batchContext("tagging");
		return startBatch(context, () =>
			actions.startBatchTagging({
				force: context.force,
				mediaSourceId: context.mediaSourceId,
			}),
		);
	};
	const handleStartThumbnailWarmup = async () => {
		const context = batchContext("thumbnails");
		const mediaSourceId = context.mediaSourceId;
		if (!mediaSourceId) {
			toast.error("Select a media source first.");
			return;
		}
		await startBatch(context, () =>
			actions.startThumbnailWarmup({
				mediaSourceId,
				missingOnly: true,
				size: 256,
			}),
		);
	};
	const refreshTrackedJob = () => {
		if (trackedRun()) void trackedJob.refetch();
	};
	const jobHandlers: ManagerJobHandlers = {
		handleJobProgress: (event) => {
			batches.observe({ event: "job-progress", data: event });
			refreshTrackedJob();
		},
		handleJobCompleted: (event) => {
			batches.observe({ event: "job-completed", data: event });
			toast.success(event.message || "Batch operation completed!");
			refreshTrackedJob();
		},
		handleJobFailed: (event) => {
			batches.observe({ event: "job-failed", data: event });
			toast.error(`Job failed: ${event.error || "unknown error"}`);
			refreshTrackedJob();
		},
		handleJobCancelled: () => {
			const jobId = trackedRun()?.jobId;
			if (jobId) batches.observe({ event: "job-cancelled", data: { jobId } });
			refreshTrackedJob();
		},
	};

	// Fast children may publish parent progress before the start request returns.
	// Buffer those events until activeJobId is known.
	useBatchJobEvents?.(activeJobId, jobHandlers, {
		subscribeImmediately: true,
		onEvent: (event) => {
			if (event.data.jobId !== activeJobId() || event.event === "job-retried")
				batches.observe(event);
			if (
				event.event === "job-progress" ||
				event.event === "job-retried" ||
				activeBatches.isFetching ||
				activeBatches.data?.some((job) => job.id === event.data.jobId)
			)
				refreshActiveBatches();
		},
		onConnected: () => {
			refreshActiveBatches();
			if (trackedRun()) void trackedJob.refetch();
		},
	});

	return {
		activeTab,
		vectorModel,
		setVectorModel: (value) => {
			const next = setVectorModel(value);
			batches.invalidateScans();
			return next;
		},
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
		setSelectedSourceId: changeSelectedSourceId,
		forceRetag,
		setForceRetag: (value) => {
			const next = setForceRetag(value);
			batches.invalidateScans();
			return next;
		},
		activeBatches: () => activeBatches.data ?? [],
		activeBatchesFailed: () => activeBatches.isError,
		retryActiveBatches: refreshActiveBatches,
		taggingStatus,
		jobProgress,
		jobStatus,
		activeJobId,
		batchPendingAction,
		batchDisplayKind: () => batchDisplay()?.kind ?? null,
		displayedJobId: () => batchDisplay()?.jobId ?? null,
		trackBatchJob: (job) => {
			const context = batchContext(
				job.type === "bulk_tagging_parent"
					? "tagging"
					: job.type === "thumbnail_generation_parent"
						? "thumbnails"
						: "vectors",
			);
			const run = {
				...context,
				jobId: job.id,
				mediaSourceId: job.mediaSourceId ?? undefined,
				vectorModel:
					job.type === "extract_embedding_batch"
						? ("embeddinggemma2" as const)
						: ("ccip" as const),
			};
			batches.select(run);
			batches.acceptSnapshot(job, batches.version(job.id));
			setActiveTab(run.tab);
		},
		sources,
		ips,
		getActiveItems,
		queryStates,
		retryQueries,
		openCreateDialog,
		openEditDialog,
		handleSave: () => (editingItem() ? handleUpdate() : handleCreate()),
		handleConfirmDelete,
		handleScan,
		handleStartBatchTagging,
		handleStartBatchCcipExtraction,
		handleStartThumbnailWarmup,
		jobHandlers,
		// Duplicates
		duplicateSourceId: duplicates.sourceId,
		setDuplicateSourceId: duplicates.setSourceId,
		duplicateGroups: duplicates.groups,
		keepIds: duplicates.keepIds,
		duplicateStatus: duplicates.status,
		isScanningDuplicates: duplicates.scanning,
		isDeletingDuplicates: duplicates.deleting,
		isDuplicateDeleteDialogOpen: duplicates.dialogOpen,
		setIsDuplicateDeleteDialogOpen: duplicates.setDialogOpen,
		duplicatesToDelete: duplicates.itemsToDelete,
		handleScanDuplicates: duplicates.scan,
		handleDeleteDuplicates: async () => duplicates.prepareDelete(),
		setKeepForGroup: duplicates.setKeepForGroup,
		selectKeepOldest: duplicates.selectKeepOldest,
		selectKeepLargest: duplicates.selectKeepLargest,
		handleConfirmDeleteDuplicates: duplicates.confirmDelete,
		deleteCount: duplicates.deleteCount,
	};
}
