import { client } from "~/orpc-client";

export function scanBatchTaggingTargets(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.scanBatchTaggingTargets(params);
}

export function startBatchTagging(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.startBatchTagging(params);
}

export function scanBatchCcipTargets(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.scanBatchCcipTargets(params);
}

export function startBatchCcipExtraction(params: {
	force?: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.startBatchCcipExtraction(params);
}

export function scanBatchEmbeddingTargets(params: {
	force: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.scanBatchEmbeddingTargets(params);
}
export function startBatchEmbeddingExtraction(params: {
	force: boolean;
	mediaSourceId?: string;
}) {
	return client.ai.startBatchEmbeddingExtraction(params);
}
