import { useManagerPage } from "@solid-imager/ui/hooks/use-manager-page";
import { ManagerScreen } from "@solid-imager/ui/screens/manager-screen";
import type { V2ManagerTransferFormat } from "@solid-imager/ui/screens/v2-manager-screen";
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
	fetchSourceDump,
	importSourceLanceDB,
	importSourceNdjson,
	importSourceZip,
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

function downloadBlob(blob: Blob, fileName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function dumpFileName(
	sourceId: string,
	format: V2ManagerTransferFormat,
): string {
	switch (format) {
		case "ndjson":
			return `source-${sourceId}-dump.ndjson`;
		case "tar":
			return `source-${sourceId}-dump.tar`;
		case "lancedb":
			return `source-${sourceId}-dump-lancedb.tar`;
	}
}

const transferActions = {
	exportSource: async (input: {
		format: V2ManagerTransferFormat;
		includeImages: boolean;
		sourceId: string;
	}) => {
		try {
			const mode =
				input.format === "ndjson"
					? "json"
					: input.format === "tar"
						? "zip"
						: "lancedb";
			const blob = await fetchSourceDump(input.sourceId, mode, {
				includeImages: input.format === "lancedb" && input.includeImages,
			});
			downloadBlob(blob, dumpFileName(input.sourceId, input.format));
			toast.success("Source dump downloaded");
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
			const result =
				input.format === "ndjson"
					? await importSourceNdjson(input.sourceId, input.file)
					: input.format === "tar"
						? await importSourceZip(input.sourceId, input.file)
						: await importSourceLanceDB(input.sourceId, input.file);
			toast.success(`Restore complete: ${result.importedCount} items imported`);
			return { importedCount: result.importedCount };
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Restore failed");
			throw error;
		}
	},
};

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
		<ManagerScreen
			manager={manager}
			transferActions={transferActions}
			variant="v2"
		/>
	);
}
