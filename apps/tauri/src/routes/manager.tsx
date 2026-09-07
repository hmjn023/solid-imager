import {
	prefetchManagerPageQueries,
	useManagerPage,
} from "@solid-imager/ui/hooks/use-manager-page";
import { jobsQueryKeys } from "@solid-imager/ui/query-options";
import type { V2ManagerTransferFormat } from "@solid-imager/ui/screens/manager/types";
import { V2ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
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
	fetchSourceDump,
	importSourceNdjson,
	importSourceZip,
} from "~/infrastructure/api-clients/sources-api";
import { startThumbnailWarmup } from "~/infrastructure/api-clients/thumbnails-api";
import {
	allCharactersQueryOptions,
	allIpsQueryOptions,
	allProjectsQueryOptions,
	mediaSourcesQueryOptions,
} from "~/queries";

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
	startThumbnailWarmup,
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
				const blob = await fetchSourceDump(input.sourceId, mode, {
					includeImages: input.includeImages,
				});
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = `${input.sourceId}.${mode}`;
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				URL.revokeObjectURL(url);
				toast.success("Export downloaded");
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
				const job =
					input.format === "ndjson"
						? await importSourceNdjson(input.sourceId, input.file)
						: await importSourceZip(input.sourceId, input.file);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				toast.success(`Restore queued (${job.id.slice(0, 8)})`);
				return { jobId: job.id };
			} catch (error) {
				toast.error(error instanceof Error ? error.message : "Restore failed");
				throw error;
			}
		},
	};
}

export const Route = createFileRoute("/manager")({
	loader: ({ context }) => {
		prefetchManagerPageQueries(context.queryClient, managerQueryOptions);
	},
	component: ManagerPage,
});

function ManagerPage() {
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
