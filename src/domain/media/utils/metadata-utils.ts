import type { ExtractedData } from "~/domain/media/schemas";
import { extractTagsFromWorkflow } from "~/domain/tags/extractor";
import { type Workflow, workflowSchema } from "~/domain/tags/schemas";

function parseWorkflowAndExtractTags(text: string): {
  parsed: Workflow | null;
  tags: ExtractedData["tags"];
} {
  const tags: ExtractedData["tags"] = [];
  try {
    const parsed = workflowSchema.parse(JSON.parse(text));
    const extracted = extractTagsFromWorkflow(parsed);
    if (extracted) {
      for (const t of extracted.positiveTags) {
        tags.push({ name: t.name, type: "positive" as const });
      }
      for (const t of extracted.negativeTags) {
        tags.push({ name: t.name, type: "negative" as const });
      }
    }
    return { parsed, tags };
  } catch (_error) {
    return { parsed: null, tags: [] };
  }
}

function processCommentChunk(chunk: {
  keyword: string;
  text: string;
}): Partial<ExtractedData> {
  // InvokeAI prompt format is a JSON object containing the prompt itself.
  if (chunk.keyword === "prompt") {
    try {
      // It might be a simple string or a JSON object string.
      const parsed = JSON.parse(chunk.text);
      if (typeof parsed === "object" && parsed !== null && "nodes" in parsed) {
        // This looks like a ComfyUI workflow embedded in a prompt
        const { tags } = parseWorkflowAndExtractTags(chunk.text);
        return { prompt: chunk.text, tags };
      }
      return { prompt: chunk.text, tags: [] };
    } catch {
      // Not a JSON, treat as a simple prompt string
      return { prompt: chunk.text, tags: [] };
    }
  }

  if (chunk.keyword === "workflow") {
    const { parsed, tags } = parseWorkflowAndExtractTags(chunk.text);
    return { workflow: parsed, tags };
  }

  return {};
}

export function extractDataFromComments(
  comments: { keyword: string; text: string }[]
): ExtractedData {
  const finalData: ExtractedData = {
    tags: [],
    prompt: null,
    workflow: null,
  };

  for (const chunk of comments) {
    const processedChunk = processCommentChunk(chunk);
    if (processedChunk.tags) {
      finalData.tags.push(...processedChunk.tags);
    }
    if (processedChunk.prompt) {
      finalData.prompt = processedChunk.prompt;
    }
    if (processedChunk.workflow) {
      finalData.workflow = processedChunk.workflow;
    }
  }

  // Deduplicate tags
  const uniqueTags: ExtractedData["tags"] = [];
  const seenTags = new Set<string>();
  for (const tag of finalData.tags) {
    const tagIdentifier = `${tag.name}:${tag.type}`;
    if (!seenTags.has(tagIdentifier)) {
      uniqueTags.push(tag);
      seenTags.add(tagIdentifier);
    }
  }
  finalData.tags = uniqueTags;

  return finalData;
}
