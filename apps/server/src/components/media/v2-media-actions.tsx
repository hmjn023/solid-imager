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
import { Button } from "@solid-imager/ui/button";
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
	Download,
	Scan,
	ScanSearch,
	Sparkles,
	Trash2,
} from "@solid-imager/ui/v2/icons";
import { useNavigate } from "@tanstack/solid-router";
import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { AiTaggingModal } from "~/components/media/ai-tagging-modal";
import CharacterCropModal from "~/components/media/character-crop-modal";
import { OppaiOracleModal } from "~/components/media/oppai-oracle-modal";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	getCcipVectorStatus,
	startCcipExtraction,
} from "~/infrastructure/api-clients/ai-api";
import { deleteMedia } from "~/infrastructure/api-clients/media-api";

type MediaActionsProps = {
	media: MediaDetails;
	onUpdate?: () => void;
};

const CCIP_STATUS_REFRESH_INTERVAL_MS = 1_000;
const CCIP_MISSING_STATUS_LIMIT = 5;

export function V2MediaActions(props: MediaActionsProps) {
	const navigate = useNavigate();
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
		setMoreActionsOpen(false);
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
		activateVectorSearch(props.media.id, { surface: "v2" });
		void navigate({ to: "/v2/search" });
	};
	const handleDownload = () => {
		setMoreActionsOpen(false);
		const anchor = document.createElement("a");
		anchor.href = `/api/sources/${encodeURIComponent(props.media.mediaSourceId)}/${encodeURIComponent(props.media.id)}`;
		anchor.download = props.media.fileName;
		anchor.click();
	};
	const handleDelete = async () => {
		if (isDeleting()) return;
		setIsDeleting(true);
		try {
			await deleteMedia(props.media.mediaSourceId, props.media.id);
			setIsDeleteDialogOpen(false);
			toast.success("Media deleted");
			await navigate({
				params: { mediaSourceId: props.media.mediaSourceId },
				replace: true,
				to: "/v2/sources/$mediaSourceId",
			});
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

	return (
		<>
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
				<Popover
					onOpenChange={setMoreActionsOpen}
					open={moreActionsOpen()}
					placement="bottom-end"
				>
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
						<div class="my-1 border-[var(--v2-border)] border-t" />
						<Button
							class="h-9 w-full justify-start px-2"
							onClick={handleDownload}
							size="sm"
							variant="ghost"
						>
							<Download aria-hidden="true" size={14} />
							Download original
						</Button>
						<Button
							class="h-9 w-full justify-start px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
							onClick={() => setIsDeleteDialogOpen(true)}
							size="sm"
							variant="ghost"
						>
							<Trash2 aria-hidden="true" size={14} />
							Delete media…
						</Button>
					</PopoverContent>
				</Popover>
			</div>

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
						<AlertDialogAction
							disabled={isDeleting()}
							onClick={(event) => {
								event.preventDefault();
								void handleDelete();
							}}
						>
							{isDeleting() ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
