import { t } from "@solid-imager/i18n";
import {
	bulkMediaOperationResultSchema,
	type BulkMediaOperationResult,
} from "@solid-imager/core/media";

export type BulkActionType =
	| "copy-source"
	| "move-source"
	| "move-folder"
	| "delete";
export type BulkActionItem = { mediaId: string; mediaSourceId: string };
export type BulkActionCommand = {
	readonly action: BulkActionType;
	readonly items: readonly BulkActionItem[];
	readonly targetSourceId: string;
	readonly destinationPath: string;
};
export type BulkCommandOperations = {
	bulkCopyToSource: (
		sourceId: string,
		ids: string[],
		targetId: string,
	) => Promise<BulkMediaOperationResult>;
	bulkMoveToSource: (
		sourceId: string,
		ids: string[],
		targetId: string,
	) => Promise<BulkMediaOperationResult>;
	bulkMoveMedia: (
		sourceId: string,
		ids: string[],
		path: string,
	) => Promise<BulkMediaOperationResult>;
	bulkDeleteMedia: (sourceId: string, ids: string[]) => Promise<unknown>;
};

/** Snapshot all inputs before the first async step. A retry retains the same destination. */
export function createBulkActionCommand(
	input: BulkActionCommand,
): BulkActionCommand {
	if (!input.items.length)
		throw new Error(t("bulkActionCommand.noMediaItemsAreSelected"));
	if (
		(input.action === "copy-source" || input.action === "move-source") &&
		!input.targetSourceId
	)
		throw new Error(t("bulkActionCommand.targetSourceIsRequired"));
	if (input.action === "move-folder" && !input.destinationPath.trim())
		throw new Error(t("bulkActionCommand.destinationPathIsRequired"));
	return Object.freeze({
		...input,
		items: Object.freeze([
			...new Map(
				input.items.map((item) => [item.mediaId, Object.freeze({ ...item })]),
			).values(),
		]),
	});
}

/** Only explicit failed/not-processed outcomes can be retried automatically.
 * A lost response may conceal a committed copy, so it remains selected for reconciliation.
 */
export async function executeBulkActionCommand(
	command: BulkActionCommand,
	operations: BulkCommandOperations,
) {
	const groups = new Map<string, BulkActionItem[]>();
	for (const item of command.items)
		groups.set(item.mediaSourceId, [
			...(groups.get(item.mediaSourceId) ?? []),
			item,
		]);
	const succeededMediaIds: string[] = [];
	const retryItems: BulkActionItem[] = [];
	const uncertainItems: BulkActionItem[] = [];
	for (const [sourceId, items] of groups) {
		const ids = items.map((item) => item.mediaId);
		try {
			let result: BulkMediaOperationResult;
			switch (command.action) {
				case "copy-source":
					result = await operations.bulkCopyToSource(
						sourceId,
						ids,
						command.targetSourceId,
					);
					break;
				case "move-source":
					result = await operations.bulkMoveToSource(
						sourceId,
						ids,
						command.targetSourceId,
					);
					break;
				case "move-folder":
					result = await operations.bulkMoveMedia(
						sourceId,
						ids,
						command.destinationPath,
					);
					break;
				case "delete":
					await operations.bulkDeleteMedia(sourceId, ids);
					result = {
						success: true,
						items: ids.map((mediaId) => ({ mediaId, status: "succeeded" })),
					};
			}
			const parsed = bulkMediaOperationResultSchema.parse(result);
			const outcomes = new Map(
				parsed.items.map((item) => [item.mediaId, item]),
			);
			for (const item of items) {
				const outcome = outcomes.get(item.mediaId);
				if (outcome?.status === "succeeded")
					succeededMediaIds.push(item.mediaId);
				else if (
					outcome &&
					!(outcome.status === "failed" && outcome.retryable === false)
				)
					retryItems.push(item);
				else uncertainItems.push(item);
			}
		} catch {
			uncertainItems.push(...items);
		}
	}
	return { succeededMediaIds, retryItems, uncertainItems };
}
