import type { DownloadItem } from "../media/schemas";
import type { ImportCutoverReport, ImportRequest } from "../imports/schemas";
import type { Transaction } from "../interfaces/transaction-manager";

export type IImportRequestRepository = {
	ensureCutover(): Promise<ImportCutoverReport>;
	rollback(): Promise<number>;
	assertDedicated(tx: Transaction): Promise<void>;
	create(items: DownloadItem[], tx: Transaction): Promise<number>;
	listPending(tx: Transaction): Promise<ImportRequest[]>;
	countPending(tx: Transaction): Promise<number>;
	lockPending(ids: string[], tx: Transaction): Promise<ImportRequest[]>;
	approve(ids: string[], sourceId: string, tx: Transaction): Promise<void>;
	cancel(ids: string[], tx: Transaction): Promise<void>;
};
