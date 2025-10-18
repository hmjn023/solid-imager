import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";

const f = (n: number) => {
  if (n > 0) {
    return Effect.succeed(n);
  }
  if (n === 0) {
    return Effect.fail(
      new ConstraintError({
        message: "Constraint error",
        details: { code: "23505" },
      })
    );
  }
  return Effect.fail(
    new UnknownDbError({
      message: "Unknown error",
      details: "error",
    })
  );
};

describe("test", () => {
  it("should return a number", async () => {
    const result = await Effect.runPromise(f(1));
    expect(result).toBe(1);
  });

  it("should return ConstraintError", async () => {
    const result = await Effect.runPromiseExit(f(0));
    console.log(JSON.stringify(result, null, 2));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause.value).toBeInstanceOf(ConstraintError);
    }
  });

  it("should return UnknownDbError", async () => {
    const result = await Effect.runPromiseExit(f(-1));
    console.log(JSON.stringify(result, null, 2));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    }
  });
});
