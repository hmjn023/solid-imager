import type { MediaDetails } from "@solid-imager/core/domain/media/schemas";
import type {
	CcipVectorStatus,
	StartCcipExtractionResponse,
} from "@solid-imager/core/domain/tagging/schemas";
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
import type { ManagerJobHandlers } from "./hooks/use-manager-page";
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
	onFindSimilar?: () => void;
	onDownload?: () => void | Promise<void>;
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
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDeleting, setIsDeleting] = createSignal(false);
	const [ccipMissingStatusCount, setCcipMissingStatusCount] = createSignal(0);
	let ccipStatusRequestId = 0;

	const refreshCcipStatus = async () => {
		if (!props.getCcipVectorStatus) return;
		const requestId = ccipStatusRequestId + 1;
		ccipStatusRequestId = requestId;
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
		on([() => props.media.id, () => props.media.mediaSourceId], () => {
			setIsExtractingCcip(false);
			setIsCcipJobPending(false);
			setCcipStatus(props.getCcipVectorStatus ? "missing" : "ready");
			setActiveCcipJobId(null);
			setCcipMissingStatusCount(0);
			void refreshCcipStatus();
		}),
	);

	const handleCcipExtraction = async () => {
		if (!props.startCcipExtraction) return;
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
						toast.error(`Failed to extract CCIP vector: ${event.error}`);
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
			toast.error(`Failed to download media: ${getErrorMessage(error)}`);
		}
	};

	const handleDelete = async () => {
		if (!props.onDelete || isDeleting()) return;
		setIsDeleting(true);
		try {
			await props.onDelete();
			setIsDeleteDialogOpen(false);
			toast.success("Media deleted");
		} catch (error) {
			toast.error(`Failed to delete media: ${getErrorMessage(error)}`);
		} finally {
			setIsDeleting(false);
		}
	};

	const ccipActionLabel = () => {
		if (ccipStatus() === "ready" || ccipStatus() === "stale") {
			return "Re-extract CCIP vector";
		}
		if (ccipStatus() === "processing") return "Extracting CCIP vector…";
		return "Extract CCIP vector";
	};
	const hasCcipActions = props.getCcipVectorStatus && props.startCcipExtraction;

	return (
		<>
			<div class="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
				<ShowAction when={props.aiTaggingModal}>
					<Button
						class="h-10 min-w-32 flex-1 md:h-9 md:flex-none"
						onClick={() => setIsAiTaggingModalOpen(true)}
						size="sm"
					>
						<Sparkles aria-hidden="true" size={15} />
						Extract tags
					</Button>
				</ShowAction>
				<ShowAction when={props.onFindSimilar}>
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
								: "CCIP vector is required before similar search"
						}
						variant="outline"
					>
						<ScanSearch aria-hidden="true" size={15} />
						Find similar
					</Button>
				</ShowAction>
				<ShowAction
					when={
						props.oppaiOracleModal ||
						props.characterCropModal ||
						hasCcipActions ||
						props.onDownload ||
						props.onDelete
					}
				>
					<Popover
						onOpenChange={setMoreActionsOpen}
						open={moreActionsOpen()}
						placement="bottom-end"
					>
						<PopoverTrigger class="flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--workspace-border-strong)] bg-[var(--workspace-surface)] px-3 font-medium text-[var(--workspace-text)] text-xs outline-none hover:bg-[var(--workspace-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] md:h-9 md:flex-none">
							More actions
							<ChevronDown aria-hidden="true" size={14} />
						</PopoverTrigger>
						<PopoverContent class="workspace-theme w-64 space-y-1 p-1.5 shadow-xl">
							<ShowAction when={props.oppaiOracleModal}>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() => setIsOppaiOracleModalOpen(true)}
									size="sm"
									variant="ghost"
								>
									<Sparkles aria-hidden="true" size={14} />
									Extract tags (OppaiOracle)
								</Button>
							</ShowAction>
							<ShowAction when={props.characterCropModal}>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() => setIsCharacterCropModalOpen(true)}
									size="sm"
									variant="ghost"
								>
									<Scan aria-hidden="true" size={14} />
									Detect &amp; crop characters
								</Button>
							</ShowAction>
							<ShowAction when={hasCcipActions}>
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
									class="px-2 py-1 text-[11px] text-[var(--workspace-text-muted)]"
								>
									CCIP status: {ccipStatus()}
								</p>
							</ShowAction>
							<ShowAction when={props.onDownload || props.onDelete}>
								<div class="my-1 border-[var(--workspace-border)] border-t" />
							</ShowAction>
							<ShowAction when={props.onDownload}>
								<Button
									class="h-9 w-full justify-start px-2"
									onClick={() => void handleDownload()}
									size="sm"
									variant="ghost"
								>
									<Download aria-hidden="true" size={14} />
									Download original
								</Button>
							</ShowAction>
							<ShowAction when={props.onDelete}>
								<Button
									class="h-9 w-full justify-start px-2 text-[var(--workspace-destructive)] hover:bg-[var(--workspace-surface-muted)] hover:text-[var(--workspace-destructive-hover)]"
									onClick={() => setIsDeleteDialogOpen(true)}
									size="sm"
									variant="ghost"
								>
									<Trash2 aria-hidden="true" size={14} />
									Delete media…
								</Button>
							</ShowAction>
						</PopoverContent>
					</Popover>
				</ShowAction>
			</div>

			<ShowAction when={props.aiTaggingModal}>
				{props.aiTaggingModal?.({
					isOpen: isAiTaggingModalOpen(),
					onClose: () => setIsAiTaggingModalOpen(false),
				})}
			</ShowAction>
			<ShowAction when={props.oppaiOracleModal}>
				{props.oppaiOracleModal?.({
					isOpen: isOppaiOracleModalOpen(),
					onClose: () => setIsOppaiOracleModalOpen(false),
				})}
			</ShowAction>
			<ShowAction when={props.characterCropModal}>
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
							<AlertDialogTitle>Delete this media?</AlertDialogTitle>
							<AlertDialogDescription>
								{props.media.fileName} will be permanently removed from its
								source. This action cannot be undone.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel disabled={isDeleting()}>
								Cancel
							</AlertDialogCancel>
							<Button
								disabled={isDeleting()}
								onClick={() => void handleDelete()}
								variant="destructive"
							>
								{isDeleting() ? "Deleting…" : "Delete"}
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
