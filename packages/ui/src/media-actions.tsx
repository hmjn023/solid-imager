import { ccipStatusLabel } from "./display-labels";
import { t } from "@solid-imager/i18n";
import type { MediaDetails } from "@solid-imager/core/media";
import type {
	CcipVectorStatus,
	StartCcipExtractionResponse,
} from "@solid-imager/core/tagging";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	type Accessor,
	createEffect,
	createSignal,
	on,
	onCleanup,
} from "solid-js";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import type { ManagerJobHandlers } from "./hooks/batch-job-events.types";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { toast } from "./toast";
import {
	Binary,
	ChevronDown,
	Download,
	Scan,
	ScanSearch,
	Sparkles,
	Trash2,
} from "./workspace/icons";

export type MediaActionModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

export type MediaActionsProps = {
	media: MediaDetails;
	onUpdate?: () => void;
	onFindSimilar?: (
		model?: import("@solid-imager/core/search").SimilarityModel,
	) => void;
	onDownload?: () => void | Promise<void>;
	onViewJobs?: (jobId: string) => void;
	onDelete?: () => void | Promise<void>;
	aiTaggingModal?: (
		props: MediaActionModalProps,
	) => import("solid-js").JSX.Element;
	characterCropModal?: (
		props: MediaActionModalProps,
	) => import("solid-js").JSX.Element;
	oppaiOracleModal?: (
		props: MediaActionModalProps,
	) => import("solid-js").JSX.Element;
	getCcipVectorStatus?: () => Promise<CcipVectorStatus>;
	startCcipExtraction?: (
		force: boolean,
	) => Promise<StartCcipExtractionResponse>;
	startEmbeddingExtraction?: () => Promise<StartCcipExtractionResponse>;
	useCcipJobEvents?: (
		activeJobId: Accessor<string | null>,
		handlers: ManagerJobHandlers,
		options?: { subscribeImmediately?: boolean },
	) => void;
};

const CCIP_STATUS_REFRESH_INTERVAL_MS = 1_000;
const CCIP_MISSING_STATUS_LIMIT = 5;

export function MediaActions(props: MediaActionsProps) {
	const [isAiTaggingModalOpen, setIsAiTaggingModalOpen] = createSignal(false);
	const [isOppaiOracleModalOpen, setIsOppaiOracleModalOpen] =
		createSignal(false);
	const [isCharacterCropModalOpen, setIsCharacterCropModalOpen] =
		createSignal(false);
	const [moreActionsOpen, setMoreActionsOpen] = createSignal(false);
	const [ccipStatus, setCcipStatus] = createSignal<
		"missing" | "processing" | "ready" | "stale" | "failed"
	>("missing");
	const [activeCcipJobId, setActiveCcipJobId] = createSignal<string | null>(
		null,
	);
	const [isCcipJobPending, setIsCcipJobPending] = createSignal(false);
	const [isExtractingCcip, setIsExtractingCcip] = createSignal(false);
	const [isExtractingEmbedding, setIsExtractingEmbedding] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDeleting, setIsDeleting] = createSignal(false);
	const [ccipMissingStatusCount, setCcipMissingStatusCount] = createSignal(0);
	let ccipStatusRequestId = 0;
	const supportsVisualAnalysis = () =>
		props.media.mediaType === "image" || props.media.mediaType === "video";
	const supportsCropping = () => props.media.mediaType === "image";

	const refreshCcipStatus = async () => {
		const requestId = ccipStatusRequestId + 1;
		ccipStatusRequestId = requestId;
		if (!supportsVisualAnalysis() || !props.getCcipVectorStatus) return;
		const activeJobIdAtRequest = activeCcipJobId();
		try {
			const result = await props.getCcipVectorStatus();
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
		on(
			[
				() => props.media.id,
				() => props.media.mediaSourceId,
				() => props.media.mediaType,
			],
			() => {
				setIsAiTaggingModalOpen(false);
				setIsOppaiOracleModalOpen(false);
				setIsCharacterCropModalOpen(false);
				setMoreActionsOpen(false);
				setIsExtractingCcip(false);
				setIsExtractingEmbedding(false);
				setIsCcipJobPending(false);
				setCcipStatus(props.getCcipVectorStatus ? "missing" : "ready");
				setActiveCcipJobId(null);
				setCcipMissingStatusCount(0);
				void refreshCcipStatus();
			},
		),
	);

	const handleEmbeddingExtraction = async () => {
		if (
			!supportsVisualAnalysis() ||
			!props.startEmbeddingExtraction ||
			isExtractingEmbedding()
		)
			return;
		setMoreActionsOpen(false);
		setIsExtractingEmbedding(true);
		const mediaId = props.media.id;
		try {
			const result = await props.startEmbeddingExtraction();
			toast.success(t("mediaActions.embeddingGemma2ExtractionQueued"), {
				duration: 7_000,
				action: props.onViewJobs
					? {
							label: t("actions.viewJobs"),
							onClick: () => props.onViewJobs?.(result.jobId),
						}
					: undefined,
			});
		} catch (error) {
			toast.error(
				t("mediaActions.failedToExtractEmbeddingGemma2VectorValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			if (props.media.id === mediaId) setIsExtractingEmbedding(false);
		}
	};

	const handleCcipExtraction = async () => {
		if (!supportsVisualAnalysis() || !props.startCcipExtraction) return;
		setMoreActionsOpen(false);
		setIsExtractingCcip(true);
		const currentMediaId = props.media.id;
		const currentMediaSourceId = props.media.mediaSourceId;
		const isCurrentMedia = () =>
			props.media.id === currentMediaId &&
			props.media.mediaSourceId === currentMediaSourceId;
		try {
			const result = await props.startCcipExtraction(
				ccipStatus() === "ready" || ccipStatus() === "stale",
			);
			if (!isCurrentMedia()) return;
			setCcipStatus("processing");
			setActiveCcipJobId(result.jobId);
			setIsCcipJobPending(true);
			setCcipMissingStatusCount(0);
			void refreshCcipStatus();
			toast.success(t("mediaActions.cCIPVectorExtractionQueued"), {
				duration: 7_000,
				action: props.onViewJobs
					? {
							label: t("actions.viewJobs"),
							onClick: () => props.onViewJobs?.(result.jobId),
						}
					: undefined,
			});
		} catch (error) {
			if (!isCurrentMedia()) return;
			toast.error(
				t("mediaActions.failedToExtractCCIPVectorValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			if (isCurrentMedia()) {
				setIsExtractingCcip(false);
			}
		}
	};

	if (props.useCcipJobEvents) {
		props.useCcipJobEvents(
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
						toast.error(
							t("mediaActions.failedToExtractCCIPVectorValue", {
								value0: String(event.error),
							}),
						);
					}
				},
			},
			{ subscribeImmediately: true },
		);
	}

	createEffect(() => {
		if (!isCcipJobPending() || !activeCcipJobId()) return;
		const intervalId = setInterval(() => {
			void refreshCcipStatus();
		}, CCIP_STATUS_REFRESH_INTERVAL_MS);
		onCleanup(() => clearInterval(intervalId));
	});

	const handleDownload = async () => {
		if (!props.onDownload) return;
		setMoreActionsOpen(false);
		try {
			await props.onDownload();
		} catch (error) {
			toast.error(
				t("mediaActions.failedToDownloadMediaValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		}
	};

	const openModalFromMoreActions = (openModal: () => void) => {
		setMoreActionsOpen(false);
		queueMicrotask(openModal);
	};

	const handleDelete = async () => {
		if (!props.onDelete || isDeleting()) return;
		setIsDeleting(true);
		try {
			await props.onDelete();
			setIsDeleteDialogOpen(false);
			toast.success(t("mediaActions.mediaDeleted"));
		} catch (error) {
			toast.error(
				t("mediaActions.failedToDeleteMediaValue", {
					value0: String(getErrorMessage(error)),
				}),
			);
		} finally {
			setIsDeleting(false);
		}
	};

	const ccipActionLabel = () => {
		if (ccipStatus() === "ready" || ccipStatus() === "stale") {
			return t("mediaActions.reExtractCCIPVector");
		}
		if (ccipStatus() === "processing")
			return t("mediaActions.extractingCCIPVector");
		return t("mediaActions.extractCCIPVector");
	};
	const hasCcipActions = () =>
		supportsVisualAnalysis() &&
		props.getCcipVectorStatus &&
		props.startCcipExtraction;

	return (
		<>
			<div class="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
				<ShowAction when={supportsVisualAnalysis() && props.aiTaggingModal}>
					<Button
						class="h-10 min-w-32 flex-1 md:h-9 md:flex-none"
						onClick={() => setIsAiTaggingModalOpen(true)}
						size="sm"
					>
						<Sparkles aria-hidden="true" size={15} />
						{t("mediaActions.extractTags")}
					</Button>
				</ShowAction>
				<ShowAction when={supportsVisualAnalysis() && props.onFindSimilar}>
					<Button
						class="h-10 min-w-32 flex-1 md:h-9 md:flex-none"
						disabled={
							props.getCcipVectorStatus !== undefined &&
							ccipStatus() !== "ready"
						}
						onClick={() => props.onFindSimilar?.()}
						size="sm"
						title={
							ccipStatus() === "ready"
								? undefined
								: t("mediaActions.cCIPVectorIsRequiredBeforeSimilarSearch")
						}
						variant="outline"
					>
						<ScanSearch aria-hidden="true" size={15} />
						{t("mediaActions.findSimilar")}
					</Button>
				</ShowAction>
				<ShowAction
					when={
						(supportsVisualAnalysis() &&
							(props.oppaiOracleModal ||
								props.startEmbeddingExtraction ||
								props.onFindSimilar)) ||
						(supportsCropping() && props.characterCropModal) ||
						hasCcipActions() ||
						props.onDownload ||
						props.onDelete
					}
				>
					<Popover
						onOpenChange={setMoreActionsOpen}
						open={moreActionsOpen()}
						placement="bottom-end"
					>
						<PopoverTrigger class="flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-card px-3 font-medium text-foreground text-xs outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:h-9 md:flex-none">
							{t("mediaActions.moreActions")}
							<ChevronDown aria-hidden="true" size={14} />
						</PopoverTrigger>
						<PopoverContent class="workspace-theme w-64 space-y-1 p-1.5 shadow-xl">
							<ShowAction
								when={props.onFindSimilar && supportsVisualAnalysis()}
							>
								<Button
									class="h-auto min-h-9 w-full justify-start whitespace-normal px-2 text-left"
									size="sm"
									variant="ghost"
									onClick={() => {
										setMoreActionsOpen(false);
										props.onFindSimilar?.("embeddinggemma2");
									}}
								>
									<ScanSearch aria-hidden="true" size={14} />
									{t("mediaActions.findSimilarEmbeddingGemma2")}
								</Button>
							</ShowAction>
							<ShowAction
								when={
									props.startEmbeddingExtraction && supportsVisualAnalysis()
								}
							>
								<Button
									class="h-auto min-h-9 w-full justify-start whitespace-normal px-2 text-left"
									disabled={isExtractingEmbedding()}
									onClick={() => void handleEmbeddingExtraction()}
									size="sm"
									variant="ghost"
								>
									<Binary aria-hidden="true" size={14} />
									{t("mediaActions.extractEmbeddingGemma2Vector")}
								</Button>
							</ShowAction>
							<ShowAction
								when={supportsVisualAnalysis() && props.oppaiOracleModal}
							>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() =>
										openModalFromMoreActions(() =>
											setIsOppaiOracleModalOpen(true),
										)
									}
									size="sm"
									variant="ghost"
								>
									<Sparkles aria-hidden="true" size={14} />
									{t("mediaActions.extractTagsOppaiOracle")}
								</Button>
							</ShowAction>
							<ShowAction when={supportsCropping() && props.characterCropModal}>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() =>
										openModalFromMoreActions(() =>
											setIsCharacterCropModalOpen(true),
										)
									}
									size="sm"
									variant="ghost"
								>
									<Scan aria-hidden="true" size={14} />
									{t("mediaActions.detectCropCharacters")}
								</Button>
							</ShowAction>
							<ShowAction when={hasCcipActions()}>
								<Button
									class="h-9 w-full justify-start px-2"
									disabled={isExtractingCcip() || isCcipJobPending()}
									onClick={() => void handleCcipExtraction()}
									size="sm"
									variant="ghost"
								>
									<Binary aria-hidden="true" size={14} />
									{ccipActionLabel()}
								</Button>
								<p
									aria-live="polite"
									class="px-2 py-1 text-label-sm text-muted-foreground"
								>
									{t("mediaActions.cCIPStatusValue", {
										value0: ccipStatusLabel(ccipStatus()),
									})}
								</p>
							</ShowAction>
							<ShowAction when={props.onDownload || props.onDelete}>
								<div class="my-1 border-border border-t" />
							</ShowAction>
							<ShowAction when={props.onDownload}>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() => void handleDownload()}
									size="sm"
									variant="ghost"
								>
									<Download aria-hidden="true" size={14} />
									{t("mediaActions.downloadOriginal")}
								</Button>
							</ShowAction>
							<ShowAction when={props.onDelete}>
								<Button
									class="h-9 w-full justify-start px-2 text-destructive hover:bg-muted hover:text-destructive"
									onClick={() =>
										openModalFromMoreActions(() => setIsDeleteDialogOpen(true))
									}
									size="sm"
									variant="ghost"
								>
									<Trash2 aria-hidden="true" size={14} />
									{t("mediaActions.deleteMedia")}
								</Button>
							</ShowAction>
						</PopoverContent>
					</Popover>
				</ShowAction>
			</div>
			<ShowAction
				when={
					props.media.mediaType === "video" &&
					(props.aiTaggingModal ||
						props.oppaiOracleModal ||
						props.onFindSimilar ||
						props.startEmbeddingExtraction ||
						hasCcipActions())
				}
			>
				<p class="mt-1 text-xs text-muted-foreground">
					{t("mediaActions.aIAnalyzesThisVideoSRepresentativeThumbnail")}
				</p>
			</ShowAction>

			<ShowAction when={supportsVisualAnalysis() && props.aiTaggingModal}>
				{props.aiTaggingModal?.({
					isOpen: isAiTaggingModalOpen(),
					onClose: () => setIsAiTaggingModalOpen(false),
				})}
			</ShowAction>
			<ShowAction when={supportsVisualAnalysis() && props.oppaiOracleModal}>
				{props.oppaiOracleModal?.({
					isOpen: isOppaiOracleModalOpen(),
					onClose: () => setIsOppaiOracleModalOpen(false),
				})}
			</ShowAction>
			<ShowAction when={supportsCropping() && props.characterCropModal}>
				{props.characterCropModal?.({
					isOpen: isCharacterCropModalOpen(),
					onClose: () => setIsCharacterCropModalOpen(false),
				})}
			</ShowAction>
			<ShowAction when={props.onDelete}>
				<AlertDialog
					onOpenChange={setIsDeleteDialogOpen}
					open={isDeleteDialogOpen()}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>
								{t("mediaActions.deleteThisMedia")}
							</AlertDialogTitle>
							<AlertDialogDescription>
								{t(
									"mediaActions.valueWillBePermanentlyRemovedFromItsSourceThis",
									{ value0: String(props.media.fileName) },
								)}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeleting()}>
								{t("actions.cancel")}
							</AlertDialogCancel>
							<Button
								disabled={isDeleting()}
								onClick={() => void handleDelete()}
								variant="destructive"
							>
								{isDeleting() ? t("status.deleting") : t("actions.delete")}
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</ShowAction>
		</>
	);
}

type ShowActionProps = {
	when: unknown;
	children: import("solid-js").JSX.Element;
};

function ShowAction(props: ShowActionProps) {
	return <>{props.when ? props.children : null}</>;
}
