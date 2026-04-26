import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { JobRepositoryPort } from "../ports/job-repository";
import type { MediaProcessingStep } from "./media-processing-job";

type MaintenanceMediaRepository = Pick<
	IMediaRepository,
	"findIdsWithMissingGenerationInfo" | "findAllMediaIndices"
>;

type MaintenanceSourceRepository = Pick<SourceRepository, "findById">;

type MaintenanceJobRepository = Pick<JobRepositoryPort, "createIfUnique">;

type MaintenanceLogger = {
	info?(data: unknown, message?: string): void;
	warn?(data: unknown, message?: string): void;
	error?(data: unknown, message?: string): void;
};

type MaintenanceMediaIndex = {
	id: string;
	mediaSourceId: string;
	filePath: string;
};

type MaintenanceServiceOptions = {
	thumbnailBatchSize?: number;
	enqueueChunkSize?: number;
};

type MaintenanceServiceDeps = {
	mediaRepository: MaintenanceMediaRepository;
	sourceRepository: MaintenanceSourceRepository;
	jobRepository: MaintenanceJobRepository;
	listExistingThumbnailIds: (sourceId: string) => Promise<Set<string> | null>;
	afterJobsQueued?: (sourceIds: string[]) => Promise<void> | void;
	logger?: MaintenanceLogger;
	options?: MaintenanceServiceOptions;
};

const DEFAULT_THUMBNAIL_BATCH_SIZE = 1000;
const DEFAULT_ENQUEUE_CHUNK_SIZE = 50;

export class MaintenanceService {
	private readonly mediaRepository: MaintenanceMediaRepository;
	private readonly sourceRepository: MaintenanceSourceRepository;
	private readonly jobRepository: MaintenanceJobRepository;
	private readonly listExistingThumbnailIds: (sourceId: string) => Promise<Set<string> | null>;
	private readonly afterJobsQueued: ((sourceIds: string[]) => Promise<void> | void) | undefined;
	private readonly logger: MaintenanceLogger | undefined;
	private readonly thumbnailBatchSize: number;
	private readonly enqueueChunkSize: number;

	constructor({
		mediaRepository,
		sourceRepository,
		jobRepository,
		listExistingThumbnailIds,
		afterJobsQueued,
		logger,
		options,
	}: MaintenanceServiceDeps) {
		this.mediaRepository = mediaRepository;
		this.sourceRepository = sourceRepository;
		this.jobRepository = jobRepository;
		this.listExistingThumbnailIds = listExistingThumbnailIds;
		this.afterJobsQueued = afterJobsQueued;
		this.logger = logger;
		this.thumbnailBatchSize = options?.thumbnailBatchSize ?? DEFAULT_THUMBNAIL_BATCH_SIZE;
		this.enqueueChunkSize = options?.enqueueChunkSize ?? DEFAULT_ENQUEUE_CHUNK_SIZE;
	}

	async performStartupChecks(): Promise<void> {
		this.logger?.info?.("Starting startup checks...");
		try {
			await this.queueMissingMetadata();
			await this.queueMissingThumbnails();
			this.logger?.info?.("Startup checks completed.");
		} catch (err) {
			this.logger?.error?.({ err }, "Startup checks failed");
		}
	}

	private async queueMissingMetadata() {
		try {
			const missing = await this.mediaRepository.findIdsWithMissingGenerationInfo();
			if (missing.length === 0) {
				return;
			}

			this.logger?.info?.(
				{ count: missing.length },
				"Found media with missing metadata. Queueing jobs...",
			);
			await this.dispatchJobs(missing, {
				steps: ["extractMetadata", "queueAutoTagging"],
			});
		} catch (error) {
			this.logger?.error?.({ err: error }, "Failed to queue missing metadata jobs");
		}
	}

	private async queueMissingThumbnails() {
		try {
			let offset = 0;
			let hasMore = true;

			while (hasMore) {
				const batch = await this.mediaRepository.findAllMediaIndices(undefined, {
					limit: this.thumbnailBatchSize,
					offset,
				});

				if (batch.length === 0) {
					hasMore = false;
					break;
				}

				const missingInBatch = await this.findMissingThumbnails(batch);

				if (missingInBatch.length > 0) {
					this.logger?.info?.(
						{ count: missingInBatch.length, offset },
						"Found media with missing thumbnails in batch. Queueing jobs...",
					);
					await this.dispatchJobs(missingInBatch, {
						steps: ["generateThumbnail"],
					});
				}

				offset += this.thumbnailBatchSize;
				if (batch.length < this.thumbnailBatchSize) {
					hasMore = false;
				}
			}
		} catch (error) {
			this.logger?.error?.({ err: error }, "Failed to queue missing thumbnail jobs");
		}
	}

	private async findMissingThumbnails(batch: MaintenanceMediaIndex[]) {
		const missing: MaintenanceMediaIndex[] = [];
		const mediaBySource = this.groupMediaBySource(batch);

		for (const [sourceId, items] of mediaBySource) {
			const existingFiles = await this.listExistingThumbnailIds(sourceId);
			if (!existingFiles) {
				continue;
			}

			for (const item of items) {
				if (!existingFiles.has(item.id)) {
					missing.push(item);
				}
			}
		}
		return missing;
	}

	private groupMediaBySource(batch: MaintenanceMediaIndex[]) {
		const mediaBySource = new Map<string, MaintenanceMediaIndex[]>();
		for (const media of batch) {
			if (!mediaBySource.has(media.mediaSourceId)) {
				mediaBySource.set(media.mediaSourceId, []);
			}
			mediaBySource.get(media.mediaSourceId)?.push(media);
		}
		return mediaBySource;
	}

	private async dispatchJobs(
		items: MaintenanceMediaIndex[],
		options: { steps: MediaProcessingStep[] },
	) {
		const sourceIds = [...new Set(items.map((item) => item.mediaSourceId))];
		const sources = new Map<string, string>();

		await Promise.all(
			sourceIds.map(async (sourceId) => {
				const source = await this.sourceRepository.findById(sourceId);
				if (source?.type !== "local") {
					return;
				}
				const sourcePath = (source.connectionInfo as { path?: string }).path;
				if (typeof sourcePath === "string" && sourcePath.length > 0) {
					sources.set(sourceId, sourcePath);
					return;
				}
				this.logger?.warn?.(
					{ sourceId },
					"Invalid local source config: path is missing or invalid",
				);
			}),
		);

		let queuedCount = 0;
		const queuedSourceIds: string[] = [];

		for (let index = 0; index < items.length; index += this.enqueueChunkSize) {
			const chunk = items.slice(index, index + this.enqueueChunkSize);
			const results = await Promise.allSettled(
				chunk.map(async (item) => {
					const sourcePath = sources.get(item.mediaSourceId);
					if (!sourcePath) {
						return null;
					}

					try {
						const created = await this.jobRepository.createIfUnique({
							type: "processMedia",
							mediaSourceId: item.mediaSourceId,
							payload: {
								mediaId: item.id,
								sourcePath,
								steps: options.steps,
								type: "processMedia",
							},
						});
						return created ? item.mediaSourceId : null;
					} catch (err) {
						this.logger?.error?.({ err, mediaId: item.id }, "Failed to queue media process job");
						return null;
					}
				}),
			);

			for (const result of results) {
				if (result.status === "fulfilled" && result.value) {
					queuedCount += 1;
					queuedSourceIds.push(result.value);
				}
			}
		}

		if (queuedCount > 0) {
			this.logger?.info?.({ count: queuedCount }, "Dispatched recovery jobs");
			await this.afterJobsQueued?.(queuedSourceIds);
		}
	}
}
