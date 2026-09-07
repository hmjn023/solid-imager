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

export function fetchOppaiOracleTags(params: {
	mediaSourceId: string;
	mediaId: string;
}) {
	return client.ai.tagOppaiOracle(params);
}

export function getCcipVectorStatus(mediaSourceId: string, mediaId: string) {
	return client.ai.ccipVectorStatus({ mediaSourceId, mediaId });
}

export function startCcipExtraction(
	mediaSourceId: string,
	mediaId: string,
	force = false,
) {
	return client.ai.startCcipExtraction({ mediaSourceId, mediaId, force });
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
