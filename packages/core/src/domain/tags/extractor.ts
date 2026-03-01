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
  options?: TagExtractionOptions
): { positiveTags: string[]; negativeTags: string[] } {
  const negativeKeywords =
    options?.negativeKeywords ?? DEFAULT_OPTIONS.negativeKeywords;
  const negativeTags = options?.negativeTags ?? DEFAULT_OPTIONS.negativeTags;

  const newPositiveTags: string[] = [];
  const newNegativeTags: string[] = [];

  if (typeof widgetValue === "string") {
    const tags = widgetValue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => s.replace(/ /g, "_"))
      .map((s) => s.replace(/"/g, ""));

    if (tags.length > 0) {
      const isNegativeByTitle = negativeKeywords.some((keyword) =>
        nodeTitle?.toLowerCase().includes(keyword.toLowerCase())
      );
      const isNegativeByTag = tags.some((tag) => negativeTags.includes(tag));

      if (isNegativeByTitle || isNegativeByTag) {
        newNegativeTags.push(...tags);
      } else {
        newPositiveTags.push(...tags);
      }
    }
  }
  return { positiveTags: newPositiveTags, negativeTags: newNegativeTags };
}

export function extractTagsFromWorkflow(
  workflow: Workflow,
  options?: TagExtractionOptions
) {
  const positiveNodeTypes =
    options?.positiveNodeTypes ?? DEFAULT_OPTIONS.positiveNodeTypes;

  const positiveTags: TagData[] = [];
  const negativeTags: TagData[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: ComfyUI workflow nodes can have various structures
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
    if (!node || typeof node !== "object") continue;

    const nodeType = node.type || node.class_type;
    // biome-ignore lint/suspicious/noExplicitAny: accessing optional _meta
    const nodeTitle = node.title || (node as any)._meta?.title;

    if (nodeType && positiveNodeTypes.includes(nodeType)) {
      const valuesToProcess: unknown[] = [];
      if (Array.isArray(node.widgets_values)) {
        valuesToProcess.push(...node.widgets_values);
      }
      if (node.inputs && typeof node.inputs === "object") {
        valuesToProcess.push(...Object.values(node.inputs));
      }

      for (const widgetValue of valuesToProcess) {
        const { positiveTags: newPosTags, negativeTags: newNegTags } =
          processWidgetValueTags(widgetValue, nodeTitle, options);
        positiveTags.push(
          ...newPosTags.map((tag) => ({
            name: tag,
            source: "extracted",
          }))
        );
        negativeTags.push(
          ...newNegTags.map((tag) => ({
            name: tag,
            source: "extracted",
          }))
        );
      }
    }
  }
  if (positiveTags.length > 0 || negativeTags.length > 0) {
    return { positiveTags, negativeTags };
  }

  return null;
}
