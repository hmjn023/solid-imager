import { getTaggingTaskRevision } from "@solid-imager/application/services/tagging-task-service";
import { getCcipTaskRevision } from "@solid-imager/application/services/ccip-vector-service";
import { migrateLegacyAiResults } from "@solid-imager/db/repositories/ai-result-version-cutover";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { DrizzleExecutor } from "@solid-imager/db/types";

// Frozen initial identities: never adopt legacy hashes into a later model version.
const tagging = {
	model: "pixai",
	modelVersion: "1",
	runtimeVersion: "",
	provider: "",
	device: null,
	endpoint: "",
};
const ccip = {
	...tagging,
	model: "ccip-caformer-24-randaug-pruned",
	modelVersion: "1",
	embeddingVersion: 1,
	dimensions: 768,
};

export function adoptLegacyAiResults(
	getExecutor: (tx?: Transaction) => DrizzleExecutor,
) {
	return migrateLegacyAiResults(getExecutor, {
		revision: (input, kind) =>
			kind === "tagging"
				? getTaggingTaskRevision(input, tagging)
				: getCcipTaskRevision(input, ccip),
		ccipModel: ccip.model,
		ccipEmbeddingVersion: ccip.embeddingVersion,
	});
}
