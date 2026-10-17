import {
	downloadInputSchema,
	safeDownloadRunSchema,
	type DownloadRun,
	type DownloadListRequest,
} from "@solid-imager/core/domain/downloads/schemas";
import { ResourceNotFoundError } from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IDownloadRunRepository } from "@solid-imager/core/domain/repositories/download-run-repository";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { JobEvent } from "@solid-imager/core/domain/sources/events";
import type { ILogger } from "../ports/media-service";

export function toSafeDownloadRun(run: DownloadRun) {
	return safeDownloadRunSchema.parse({
		id: run.id,
		mediaSourceId: run.mediaSourceId,
		status: run.status,
		canonicalId: run.canonicalId,
		blockedReason: run.blockedReason,
		attemptCount: run.attemptCount,
		maxAttempts: run.maxAttempts,
		nextRunAt: run.nextRunAt,
		cancelRequestedAt: run.cancelRequestedAt,
		cancelledAt: run.cancelledAt,
		startedAt: run.startedAt,
		finishedAt: run.finishedAt,
		createdAt: run.createdAt,
		updatedAt: run.updatedAt,
		targetUrl: run.input?.targetUrl ?? null,
		mediaIds:
			run.result?.mediaIds ??
			run.checkpoint?.entries.flatMap((entry) =>
				entry.mediaId ? [entry.mediaId] : [],
			) ??
			[],
		error: run.error || run.blockedReason ? "Download failed" : null,
	});
}
export class DownloadRunService {
	constructor(
		private readonly deps: {
			repo: IDownloadRunRepository;
			transactions: TransactionManager;
			alreadyStored: (urls: string[], tx: Transaction) => Promise<boolean>;
			notify?: (event: JobEvent) => void;
			logger?: ILogger;
		},
	) {}
	async initialize() {
		const report = await this.deps.repo.ensureCutover();
		if (report.migrated)
			this.deps.logger?.info(report, "Legacy downloads migrated");
	}
	async enqueue(sourceId: string, items: DownloadItem[], tx?: Transaction) {
		// Call before an import approval transaction; external transactions must already be initialized.
		if (!tx) await this.initialize();
		const action = async (transaction: Transaction) => {
			await this.deps.repo.assertDedicated(transaction);
			const eligible = [];
			let skippedCount = 0;
			for (const candidate of items) {
				const item = downloadInputSchema.parse(candidate);
				if (
					(item.sourceUrls?.length ?? 0) >= 2 &&
					(await this.deps.alreadyStored(item.sourceUrls ?? [], transaction))
				)
					skippedCount++;
				else eligible.push(item);
			}
			const result = await this.deps.repo.reserve(
				sourceId,
				eligible,
				transaction,
			);
			return {
				jobCount: result.created,
				skippedCount: skippedCount + eligible.length - result.created,
				runIds: result.receipts,
			};
		};
		return tx ? action(tx) : this.deps.transactions.transaction(action);
	}
	async get(id: string) {
		await this.initialize();
		return this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			const run = await this.deps.repo.findById(id, tx);
			if (!run) throw new ResourceNotFoundError("Download", id);
			return toSafeDownloadRun(run);
		});
	}
	async list(input: DownloadListRequest) {
		await this.initialize();
		return this.deps.transactions.transaction(async (tx) => {
			const rows = await this.deps.repo.list(input, tx);
			return { items: rows.items.map(toSafeDownloadRun), total: rows.total };
		});
	}
	private notify(event: JobEvent) {
		try {
			this.deps.notify?.(event);
		} catch (error) {
			this.deps.logger?.warn(
				{ err: error },
				"Download notification failed after commit",
			);
		}
	}
	async retry(id: string) {
		await this.initialize();
		const run = await this.deps.repo.retry(id);
		this.notify({
			event: "job-retried",
			data: { jobId: run.id, message: "Download queued for retry" },
		});
		return toSafeDownloadRun(run);
	}
	async cancel(id: string) {
		await this.initialize();
		const run = await this.deps.repo.cancel(id);
		this.notify({
			event: "job-cancelled",
			data: {
				jobId: run.id,
				message:
					run.status === "in_progress"
						? "Cancellation requested"
						: "Download cancelled",
			},
		});
		return toSafeDownloadRun(run);
	}
}
