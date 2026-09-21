import { downloadCompletedJobArtifact } from "@solid-imager/client";
import { useManagerPage } from "@solid-imager/ui/hooks/use-manager-page";
import { jobsQueryKeys } from "@solid-imager/ui/query-options";
import type { ManagerTransferFormat } from "@solid-imager/ui/screens/manager/types";
import { ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
import { toast } from "@solid-imager/ui/toast";
import { useQueryClient } from "@tanstack/solid-query";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	scanBatchCcipTargets,
	scanBatchTaggingTargets,
	startBatchCcipExtraction,
	startBatchTagging,
} from "~/infrastructure/api-clients/ai-api";
import {
	createCharacter,
	deleteCharacter,
	updateCharacter,
} from "~/infrastructure/api-clients/characters-api";
import {
	createIp,
	deleteIp,
	updateIp,
} from "~/infrastructure/api-clients/ips-api";
import {
	bulkDeleteMedia,
	findDuplicateMedia,
} from "~/infrastructure/api-clients/media-api";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import {
	createProject,
	deleteProject,
	updateProject,
} from "~/infrastructure/api-clients/projects-api";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/infrastructure/api-clients/queries";
import {
	enqueueSourceExport,
	enqueueSourceImport,
} from "~/infrastructure/api-clients/sources-api";
import { startThumbnailGeneration } from "~/infrastructure/api-clients/thumbnails";

const managerQueryOptions = {
	projects: allProjectsQueryOptions,
	ips: allIpsQueryOptions,
	characters: allCharactersQueryOptions,
	sources: mediaSourcesQueryOptions,
};

const managerActions = {
	createProject,
	updateProject,
	deleteProject,
	createIp,
	updateIp,
	deleteIp,
	createCharacter,
	updateCharacter,
	deleteCharacter,
	scanBatchTaggingTargets,
	startBatchTagging,
	scanBatchCcipTargets,
	startBatchCcipExtraction,
	findDuplicateMedia,
	bulkDeleteMedia,
	startThumbnailWarmup: (input: {
		mediaSourceId: string;
		missingOnly: true;
		size: 256;
	}) =>
		startThumbnailGeneration(input.mediaSourceId, {
			missingOnly: input.missingOnly,
			size: input.size,
		}),
};

function createTransferActions(queryClient: ReturnType<typeof useQueryClient>) {
	return {
		exportSource: async (input: {
			format: ManagerTransferFormat;
			includeImages: boolean;
			sourceId: string;
		}) => {
			try {
				const mode = input.format === "ndjson" ? "json" : "zip";
				const job = await enqueueSourceExport(
					input.sourceId,
					mode,
					input.format === "tar" && input.includeImages,
				);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				toast.info(
					`Export started (${job.id.slice(0, 8)}). Downloading when ready.`,
				);
				return {
					fileName: `source-${input.sourceId}-dump.${
						input.format === "ndjson" ? "ndjson" : "tar"
					}`,
					jobId: job.id,
				};
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Export failed");
				throw error;
			}
		},
		importSource: async (input: {
			file: File;
			format: ManagerTransferFormat;
			sourceId: string;
		}) => {
			try {
				const mode = input.format === "ndjson" ? "json" : "zip";
				const job = await enqueueSourceImport(input.sourceId, mode, input.file);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				toast.success(
					`Restore queued (${job.id.slice(0, 8)}). Track it in Jobs.`,
				);
				return { jobId: job.id };
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Restore failed");
				throw error;
			}
		},
		downloadExport: async (input: { fileName: string; jobId: string }) => {
			try {
				const blob = await downloadCompletedJobArtifact(orpc.jobs, input.jobId);
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = input.fileName;
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				setTimeout(() => URL.revokeObjectURL(url), 0);
				toast.success(`Downloaded ${input.fileName}`);
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Failed to download export",
				);
				throw error;
			}
		},
	};
}

export function ManagerPage() {
	const queryClient = useQueryClient();
	const manager = useManagerPage({
		queryClient,
		queryOptions: managerQueryOptions,
		actions: managerActions,
		useBatchJobEvents,
	});

	return (
		<ManagerScreen
			manager={manager}
			transferActions={createTransferActions(queryClient)}
		/>
	);
}
