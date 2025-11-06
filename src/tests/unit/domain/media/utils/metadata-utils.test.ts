import { describe, expect, it } from "vitest";
import { extractDataFromComments } from "~/domain/media/utils/metadata-utils";

describe("extractDataFromComments", () => {
  it("should extract positive and negative tags, prompt, and workflow from comments", () => {
    const comments = [
      {
        keyword: "prompt",
        text: JSON.stringify({
          nodes: [
            {
              type: "CR Combine Prompt",
              widgets_values: ["1girl, solo, smile"],
              title: "Positive Prompt",
            },
          ],
        }),
      },
      {
        keyword: "workflow",
        text: JSON.stringify({
          nodes: [
            {
              type: "CR Combine Prompt",
              widgets_values: ["bad anatomy, ugly, disfigured"],
              title: "Negative Prompt",
            },
          ],
        }),
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([
      { name: "1girl", type: "positive" },
      { name: "solo", type: "positive" },
      { name: "smile", type: "positive" },
      { name: "bad_anatomy", type: "negative" },
      { name: "ugly", type: "negative" },
      { name: "disfigured", type: "negative" },
    ]);
    expect(result.prompt).toBeTypeOf("string");
    expect(result.workflow).toBeTypeOf("object");
  });

  it("should handle comments with only prompt", () => {
    const comments = [
      {
        keyword: "prompt",
        text: JSON.stringify({
          nodes: [
            {
              type: "CR Combine Prompt",
              widgets_values: ["1girl, solo, smile"],
              title: "Positive Prompt",
            },
          ],
        }),
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([
      { name: "1girl", type: "positive" },
      { name: "solo", type: "positive" },
      { name: "smile", type: "positive" },
    ]);
    expect(result.prompt).toBeTypeOf("string");
    expect(result.workflow).toBeNull();
  });

  it("should handle comments with only workflow", () => {
    const comments = [
      {
        keyword: "workflow",
        text: JSON.stringify({
          nodes: [
            {
              type: "CR Combine Prompt",
              widgets_values: ["bad anatomy, ugly"],
              title: "Negative Prompt",
            },
          ],
        }),
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([
      { name: "bad_anatomy", type: "negative" },
      { name: "ugly", type: "negative" },
    ]);
    expect(result.prompt).toBeNull();
    expect(result.workflow).toBeTypeOf("object");
  });

  it("should handle comments with no prompt or workflow", () => {
    const comments: any[] = [
      {
        keyword: "other",
        text: "some other text",
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([]);
    expect(result.prompt).toBeNull();
    expect(result.workflow).toBeNull();
  });

  it("should handle malformed JSON in prompt or workflow", () => {
    const comments = [
      {
        keyword: "prompt",
        text: "not a json",
      },
      {
        keyword: "workflow",
        text: "{invalid json",
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([]);
    expect(result.prompt).toBe("not a json");
    expect(result.workflow).toBeNull();
  });

  it("should deduplicate tags", () => {
    const comments = [
      {
        keyword: "prompt",
        text: JSON.stringify({
          nodes: [
            {
              type: "CR Combine Prompt",
              widgets_values: ["1girl, solo, smile, 1girl"],
              title: "Positive Prompt",
            },
          ],
        }),
      },
    ];

    const result = extractDataFromComments(comments);

    expect(result.tags).toEqual([
      { name: "1girl", type: "positive" },
      { name: "solo", type: "positive" },
      { name: "smile", type: "positive" },
    ]);
  });
});
