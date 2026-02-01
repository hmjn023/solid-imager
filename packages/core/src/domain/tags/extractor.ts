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

  if (Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (
        positiveNodeTypes.includes(node.type) &&
        Array.isArray(node.widgets_values)
      ) {
        for (const widgetValue of node.widgets_values) {
          const { positiveTags: newPosTags, negativeTags: newNegTags } =
            processWidgetValueTags(widgetValue, node.title, options);
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
  }
  if (positiveTags.length > 0 || negativeTags.length > 0) {
    return { positiveTags, negativeTags };
  }

  return null;
}
