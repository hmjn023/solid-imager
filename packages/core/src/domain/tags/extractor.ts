import type { TagData, Workflow } from "./schemas";

/**
 * Options for tag extraction from ComfyUI workflow
 */
export type TagExtractionOptions = {
	positiveNodeTypes?: string[];
	negativeKeywords?: string[];
	negativeTags?: string[];
};

const DEFAULT_OPTIONS: Required<TagExtractionOptions> = {
	positiveNodeTypes: ["CLIPTextEncode", "CR Combine Prompt"],
	negativeKeywords: ["negative"],
	negativeTags: ["lowres"],
};

/*
function _extractTagsFromWidgetValue(
  widgetValue: unknown,
  extractedTags: string[]
) {
  if (typeof widgetValue === "string") {
    const tags = widgetValue
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    extractedTags.push(...tags);
  }
}
*/

export function processWidgetValueTags(
	widgetValue: unknown,
	nodeTitle: string | undefined,
	negativeTagSet: Set<string>,
	options?: TagExtractionOptions,
): { positiveTags: string[]; negativeTags: string[] } {
	const negativeKeywords =
		options?.negativeKeywords ?? DEFAULT_OPTIONS.negativeKeywords;

	const newPositiveTags: string[] = [];
	const newNegativeTags: string[] = [];

	if (typeof widgetValue === "string") {
		const parts = widgetValue.split(",");
		const processedTags: string[] = [];

		for (const part of parts) {
			const s = part.trim();
			if (s.length === 0) continue;
			// Combine replace(/ /g, "_") and replace(/"/g, "") in a single pass
			processedTags.push(s.replace(/[ "]/g, (ch) => (ch === " " ? "_" : "")));
		}

		if (processedTags.length > 0) {
			const isNegativeByTitle = negativeKeywords.some((keyword) =>
				nodeTitle?.toLowerCase().includes(keyword.toLowerCase()),
			);
			const isNegativeByTag = processedTags.some((tag) =>
				negativeTagSet.has(tag),
			);

			if (isNegativeByTitle || isNegativeByTag) {
				newNegativeTags.push(...processedTags);
			} else {
				newPositiveTags.push(...processedTags);
			}
		}
	}
	return { positiveTags: newPositiveTags, negativeTags: newNegativeTags };
}

type ProcessWorkflowNodeParams = {
	node: unknown;
	positiveNodeTypes: string[];
	options: TagExtractionOptions | undefined;
	positiveTags: TagData[];
	negativeTags: TagData[];
};

function processWorkflowNode({
	node,
	positiveNodeTypes,
	options,
	positiveTags,
	negativeTags,
}: ProcessWorkflowNodeParams) {
	if (typeof node !== "object" || node === null) {
		return;
	}

	// safely cast to Record since we checked it is an object
	const nodeRecord = node as Record<string, unknown>;

	const nodeType = nodeRecord.type || nodeRecord.class_type;
	const nodeTitle = nodeRecord.title || (nodeRecord as any)._meta?.title;

	if (typeof nodeType === "string" && positiveNodeTypes.includes(nodeType)) {
		const valuesToProcess: unknown[] = [];
		if (Array.isArray(nodeRecord.widgets_values)) {
			valuesToProcess.push(...nodeRecord.widgets_values);
		}
		if (nodeRecord.inputs && typeof nodeRecord.inputs === "object") {
			valuesToProcess.push(...Object.values(nodeRecord.inputs));
		}

		const negativeTagSet = new Set(
			options?.negativeTags ?? DEFAULT_OPTIONS.negativeTags,
		);
		for (const widgetValue of valuesToProcess) {
			const { positiveTags: newPosTags, negativeTags: newNegTags } =
				processWidgetValueTags(widgetValue, nodeTitle, negativeTagSet, options);
			positiveTags.push(
				...newPosTags.map((tag) => ({
					name: tag,
					source: "extracted" as const,
				})),
			);
			negativeTags.push(
				...newNegTags.map((tag) => ({
					name: tag,
					source: "extracted" as const,
				})),
			);
		}
	}
}

export function extractTagsFromWorkflow(
	workflow: Workflow,
	options?: TagExtractionOptions,
) {
	const positiveNodeTypes =
		options?.positiveNodeTypes ?? DEFAULT_OPTIONS.positiveNodeTypes;

	const positiveTags: TagData[] = [];
	const negativeTags: TagData[] = [];

	let nodesToProcess: any[] = [];
	if (workflow && Array.isArray(workflow.nodes)) {
		nodesToProcess = workflow.nodes;
	} else if (
		workflow &&
		typeof workflow === "object" &&
		!Array.isArray(workflow)
	) {
		// API format (Record<string, Node>)
		nodesToProcess = Object.values(workflow);
	}

	for (const node of nodesToProcess) {
		processWorkflowNode({
			node,
			positiveNodeTypes,
			options,
			positiveTags,
			negativeTags,
		});
	}

	if (positiveTags.length > 0 || negativeTags.length > 0) {
		return { positiveTags, negativeTags };
	}

	return null;
}
