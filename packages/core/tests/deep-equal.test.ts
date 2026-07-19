import { describe, expect, it } from "vite-plus/test";
import { deepEqual } from "../src/utils/deep-equal";

describe("deepEqual", () => {
  it("compares nested arrays by value", () => {
    expect(
      deepEqual(
        {
          type: "group",
          children: [{ type: "criterion", value: "sample" }],
        },
        {
          type: "group",
          children: [{ type: "criterion", value: "sample" }],
        },
      ),
    ).toBe(true);
  });

  it("rejects arrays with different values or lengths", () => {
    expect(deepEqual([1, 2], [1, 3])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1], { 0: 1 })).toBe(false);
  });
});
