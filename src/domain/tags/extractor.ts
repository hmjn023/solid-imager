import type { TagData, Workflow } from "./schemas";

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

export function processWidgetValueTags(
  widgetValue: unknown,
  nodeTitle: string | undefined
): { positiveTags: string[]; negativeTags: string[] } {
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
      if (
        nodeTitle?.toLowerCase().includes("negative") ||
        tags.includes("lowres")
      ) {
        newNegativeTags.push(...tags);
      } else {
        newPositiveTags.push(...tags);
      }
    }
  }
  return { positiveTags: newPositiveTags, negativeTags: newNegativeTags };
}

export function extractTagsFromWorkflow(workflow: Workflow) {
  const positiveTags: TagData[] = [];
  const negativeTags: TagData[] = [];

  if (Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (
        node.type === "CLIPTextEncode" &&
        Array.isArray(node.widgets_values)
      ) {
        for (const widgetValue of node.widgets_values) {
          const { positiveTags: newPosTags, negativeTags: newNegTags } =
            processWidgetValueTags(widgetValue, node.title);
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
