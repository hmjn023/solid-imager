import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const _Z_INDEX_REGEX = /z-\[60\]/;
const Z_INDEX_MODAL_REGEX = /Z_INDEX\.modal/;
const POSITION_REGEX = /items-start/;
const PADDING_REGEX = /pt-20/;

describe("ImportPreviewModal Layout Fixes", () => {
  const filePath = path.resolve(
    __dirname,
    "../../../../src/components/import-preview-modal.tsx"
  );
  const content = fs.readFileSync(filePath, "utf-8");

  it("should have z-index of 60 or higher", () => {
    // We expect Z_INDEX.modal to be used instead of hardcoded z-[60]
    expect(content).toMatch(Z_INDEX_MODAL_REGEX);
  });

  it("should use a robust positioning (e.g., items-start) instead of items-center", () => {
    expect(content).toMatch(POSITION_REGEX);
  });

  it("should have correct padding when using items-start", () => {
    // Usually accompanied by pt-20 or similar to avoid top overlap
    expect(content).toMatch(PADDING_REGEX);
  });
});
