import { mediaThumbnailPath } from "@solid-imager/core/http";
import { t } from "@solid-imager/i18n";
import { downloadCompletedJobArtifact } from "@solid-imager/client";
import {
	useManagerPage,
	type ManagerTransferFormat,
} from "@solid-imager/ui/manager";
import { jobsQueryKeys } from "@solid-imager/ui/query";
import { ManagerScreen } from "@solid-imager/ui/screens/manager";
import { toast } from "@solid-imager/ui/toast";
import { useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import type { JSX } from "@solidjs/web";
import { useBatchJobEvents } from "~/hooks/use-batch-job-events";
import {
	scanBatchCcipTargets,
	scanBatchEmbeddingTargets,
	startBatchEmbeddingExtraction,
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
	getActiveBatches: () => orpc.jobs.activeBatches({}),
	getJob: (jobId: string) => orpc.jobs.get({ id: jobId }),
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
	scanBatchEmbeddingTargets,
	startBatchEmbeddingExtraction,
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

const JOB_SUBMISSION_TOAST_DURATION_MS = 7000;

function createTransferActions(
	queryClient: ReturnType<typeof useQueryClient>,
	openJobs: (jobId?: string) => void,
) {
	return {
		exportSource: async (input: {
			format: ManagerTransferFormat;
			includeImages: boolean;
			sourceId: string;
		}) => {
			try {
				const mode = input.format;
				const job = await enqueueSourceExport(
					input.sourceId,
					mode,
					input.format === "tar" && input.includeImages,
				);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				toast.info(
					t("manager.exportStartedValueDownloadingWhenReady", {
						value0: String(job.id.slice(0, 8)),
					}),
					{
						duration: JOB_SUBMISSION_TOAST_DURATION_MS,
						action: {
							label: t("actions.viewJobs"),
							onClick: () => openJobs(job.id),
						},
					},
				);
				return {
					fileName: `source-${input.sourceId}-dump.${
						input.format === "ndjson" ? "ndjson" : "tar"
					}`,
					jobId: job.id,
				};
			} catch (error) {
				toast.error(t("manager.exportFailed"), {
					description: error instanceof Error ? error.message : undefined,
				});
				throw error;
			}
		},
		importSource: async (input: {
			file: File;
			format: ManagerTransferFormat;
			sourceId: string;
		}) => {
			try {
				const mode = input.format;
				const job = await enqueueSourceImport(input.sourceId, mode, input.file);
				await queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
				toast.success(
					t("manager.restoreQueuedValueTrackItInJobs", {
						value0: String(job.id.slice(0, 8)),
					}),
					{
						duration: JOB_SUBMISSION_TOAST_DURATION_MS,
						action: {
							label: t("actions.viewJobs"),
							onClick: () => openJobs(job.id),
						},
					},
				);
				return { jobId: job.id };
			} catch (error) {
				toast.error(t("manager.restoreFailed"), {
					description: error instanceof Error ? error.message : undefined,
				});
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
				toast.success(
					t("manager.downloadedValue", { value0: String(input.fileName) }),
				);
			} catch (error) {
				toast.error(t("manager.failedToDownloadExport"), {
					description: error instanceof Error ? error.message : undefined,
				});
				throw error;
			}
		},
	};
}

export function ManagerPage(): JSX.Element {
	const navigate = useNavigate({ from: "/manager" });
	const queryClient = useQueryClient();
	const openJobs = (jobId?: string) => {
		void navigate({ to: "/jobs", search: jobId ? { jobId } : {} });
	};
	const manager = useManagerPage({
		queryClient,
		queryOptions: managerQueryOptions,
		actions: managerActions,
		useBatchJobEvents,
		onOpenJobs: openJobs,
	});

	return (
		<ManagerScreen
			tagDictionaryActions={{
				dictionarySearch: orpc.tags.dictionarySearch,
				dictionaryDetail: orpc.tags.dictionaryDetail,
				dictionaryStatus: () => orpc.tags.dictionaryStatus(),
				dictionaryRefresh: () => orpc.tags.dictionaryRefresh(),
				dictionaryLegacy: orpc.tags.dictionaryLegacy,
				dictionaryMigrate: orpc.tags.dictionaryMigrate,
				openJobEvents: (signal) => orpc.jobs.events(undefined, { signal }),
			}}
			clusteringActions={{
				startClustering: async (input) => {
					const result = await orpc.characters.startClustering(input);
					void queryClient.invalidateQueries({ queryKey: jobsQueryKeys.all() });
					return result;
				},
				openJobs: () => {
					void navigate({ to: "/jobs" });
				},
				openMedia: (media) => {
					void navigate({
						to: "/sources/$mediaSourceId/$mediaId",
						params: { mediaSourceId: media.mediaSourceId, mediaId: media.id },
					});
				},
				listRuns: () => orpc.characters.clusteringRuns(),
				listGroups: (input) => orpc.characters.clusteringGroups(input),
				listMedia: (input) => orpc.characters.clusteringMedia(input),
				thumbnailUrl: (sourceId, mediaId, modifiedAt) =>
					mediaThumbnailPath(sourceId, mediaId, { cacheKey: modifiedAt }),
			}}
			authorActions={{
				beginAccountVerification: (input) =>
					orpc.authors.beginAccountVerification(input),
				getAccountVerification: (input) =>
					orpc.authors.getAccountVerification(input),
				confirmAccountVerification: async (input) => {
					const result = await orpc.authors.confirmAccountVerification(input);
					await queryClient.invalidateQueries();
					return result;
				},
				list: () => orpc.authors.list(),
				create: (input) => orpc.authors.create(input),
				updateName: (input) => orpc.authors.updateName(input),
				listMedia: (input) => orpc.authors.listMedia(input),
				correctMedia: async (input) => {
					const result = await orpc.authors.correctMedia(input);
					await queryClient.invalidateQueries();
					return result;
				},
				merge: async (input) => {
					const result = await orpc.authors.merge(input);
					await queryClient.invalidateQueries();
					return result;
				},
				thumbnailUrl: (sourceId, mediaId) =>
					mediaThumbnailPath(sourceId, mediaId),
			}}
			manager={manager}
			duplicateActions={{
				openMedia: (mediaSourceId, mediaId) => {
					void navigate({
						to: "/sources/$mediaSourceId/$mediaId",
						params: { mediaSourceId, mediaId },
					});
				},
				thumbnailUrl: (item) =>
					mediaThumbnailPath(item.mediaSourceId, item.id, {
						cacheKey: new Date(item.modifiedAt).getTime(),
					}),
			}}
			transferActions={createTransferActions(queryClient, openJobs)}
		/>
	);
}
