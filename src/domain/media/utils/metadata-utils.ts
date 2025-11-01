import { extractTagsFromWorkflow } from "~/domain/tags/extractor";
import { workflowSchema } from "~/domain/tags/schemas";

type ExtractedData = {
  tags: { name: string; type: "positive" | "negative" }[];
  prompt: object | string | null;
  workflow: object | string | null;
};

function _processCommentChunk(
  chunk: { keyword: string; text: string },
  data: ExtractedData
) {
  if (chunk.keyword === "prompt") {
    try {
      const parsedPrompt = workflowSchema.parse(JSON.parse(chunk.text));
      data.prompt = parsedPrompt;
      const extracted = extractTagsFromWorkflow(parsedPrompt);
        data.tags.push(
          ...extracted.positiveTags.map((t) => ({
            name: t.name,
            type: "positive",
          })),
          ...extracted.negativeTags.map((t) => ({
            name: t.name,
            type: "negative",
          })),
        );
    } catch (_error) {
      data.prompt = chunk.text;
    }
  }
  if (chunk.keyword === "workflow") {
    try {
      const parsedWorkflow = workflowSchema.parse(JSON.parse(chunk.text));
      data.workflow = parsedWorkflow;
      const extracted = extractTagsFromWorkflow(parsedWorkflow);
      if (extracted) {
        data.tags = [
          ...data.tags,
          ...extracted.positiveTags.map((t) => ({
            name: t.name,
            type: "positive",
          })),
          ...extracted.negativeTags.map((t) => ({
            name: t.name,
            type: "negative",
          })),
        ];
      }
    } catch (_error) {
      data.workflow = chunk.text;
    }
  }
}

export function extractDataFromComments(
  comments: { keyword: string; text: string }[]
): ExtractedData {
  const data: ExtractedData = {
    tags: [],
    prompt: null,
    workflow: null,
  };

  for (const chunk of comments) {
    _processCommentChunk(chunk, data);
  }
  return data;
}
