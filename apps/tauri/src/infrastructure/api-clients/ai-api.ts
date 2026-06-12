import { client } from "~/orpc-client";

export function scanBatchTaggingTargets(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.scanBatchTaggingTargets(params);
}

export function startBatchTaggingWithIds(params: {
	force?: boolean;
	mediaSourceId?: string;
	mediaIds: string[];
}) {
	return client.ai.startBatchTaggingWithIds(params);
}
