import { useManagerPage } from "@solid-imager/ui/hooks/use-manager-page";
import { jobsQueryKeys } from "@solid-imager/ui/query-options";
import type { V2ManagerTransferFormat } from "@solid-imager/ui/screens/v2-manager/types";
import { V2ManagerScreen } from "@solid-imager/ui/screens/v2-manager-screen";
import { toast } from "@solid-imager/ui/toast";
import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
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
			format: V2ManagerTransferFormat;
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
				toast.success(
					`Export queued (${job.id.slice(0, 8)}). Check Jobs to download it.`,
				);
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Export failed");
				throw error;
			}
		},
		importSource: async (input: {
			file: File;
			format: V2ManagerTransferFormat;
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
	};
}

export const Route = createFileRoute("/v2/manager")({
	component: V2ManagerRoute,
});

function V2ManagerRoute() {
	const queryClient = useQueryClient();
	const manager = useManagerPage({
		queryClient,
		queryOptions: managerQueryOptions,
		actions: managerActions,
		useBatchJobEvents,
	});

	return (
		<V2ManagerScreen
			manager={manager}
			transferActions={createTransferActions(queryClient)}
		/>
	);
}
