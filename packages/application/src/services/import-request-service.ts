import {
	ResourceNotFoundError,
	ResourceConflictError,
} from "@solid-imager/core/domain/errors";
import type {
	Transaction,
	TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { IImportRequestRepository } from "@solid-imager/core/domain/repositories/import-request-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import {
	safePendingImportRequestSchema,
	type ImportRequest,
} from "@solid-imager/core/domain/imports/schemas";
import type { ImportEvent } from "@solid-imager/core/domain/sources/events";
import type { ILogger } from "../ports/media-service";

export class ImportRequestService {
	constructor(
		private readonly deps: {
			repo: IImportRequestRepository;
			transactions: TransactionManager;
			sources: SourceRepository;
			prepareReservation?(): Promise<void>;
			reserve(
				sourceId: string,
				requests: ImportRequest[],
				tx: Transaction,
			): Promise<void>;
			notify?(event: ImportEvent): void;
			logger?: ILogger;
		},
	) {}
	private notify(event: ImportEvent) {
		try {
			this.deps.notify?.(event);
		} catch (error) {
			this.deps.logger?.warn(
				{ err: error },
				"Import notification failed after commit",
			);
		}
	}
	private async initialize() {
		await this.deps.prepareReservation?.();
		const report = await this.deps.repo.ensureCutover();
		if (report.migrated)
			this.deps.logger?.info(report, "Legacy import requests migrated");
	}
	async add(items: DownloadItem[]) {
		await this.initialize();
		const added = await this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			return this.deps.repo.create(items, tx);
		});
		if (added)
			this.notify({ event: "import-request:created", data: { count: added } });
		return added;
	}
	async listPending() {
		await this.initialize();
		return this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			return (await this.deps.repo.listPending(tx)).map((request) =>
				safePendingImportRequestSchema.parse({
					id: request.id,
					item: request.item,
					createdAt: request.createdAt,
				}),
			);
		});
	}
	async countPending() {
		await this.initialize();
		return this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			return this.deps.repo.countPending(tx);
		});
	}
	async process(ids: string[], sourceId: string) {
		await this.initialize();
		const processed = await this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			const pending = await this.deps.repo.lockPending(ids, tx);
			if (!pending.length) return 0;
			const source = await this.deps.sources.findById(sourceId, tx);
			if (!source) throw new ResourceNotFoundError("Media source", sourceId);
			if (source.type !== "local")
				throw new ResourceConflictError(
					"Imports require a local target source",
				);
			await this.deps.reserve(sourceId, pending, tx);
			await this.deps.repo.approve(
				pending.map((request) => request.id),
				sourceId,
				tx,
			);
			return pending.length;
		});
		if (processed)
			this.notify({
				event: "import-request:processed",
				data: { processedCount: processed },
			});
		return processed;
	}
	async cancel(ids: string[]) {
		await this.initialize();
		const cancelled = await this.deps.transactions.transaction(async (tx) => {
			await this.deps.repo.assertDedicated(tx);
			const pending = await this.deps.repo.lockPending(ids, tx);
			const selectedIds = pending.map((request) => request.id);
			await this.deps.repo.cancel(selectedIds, tx);
			return selectedIds;
		});
		if (cancelled.length)
			this.notify({
				event: "import-request:deleted",
				data: { jobIds: cancelled },
			});
	}
}
