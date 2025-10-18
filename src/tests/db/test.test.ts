import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ConstraintError, UnknownDbError } from "~/infrastructure/db/errors";

const f = (n: number) =>
  Effect.tryPromise({
    try: () =>
      new Promise((resolve, reject) => {
        if (n > 0) {
          resolve(n);
        } else if (n === 0) {
          reject({ code: "23505" });
        } else {
          reject("error");
        }
      }),
    catch: (error) => error,
  }).pipe(
    Effect.mapError((error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        return new ConstraintError({
          message: "Constraint error",
          details: error,
        });
      }
      return new UnknownDbError({
        message: "Unknown error",
        details: error,
      });
    })
  );

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
      // @ts-expect-error
      expect(result.cause.value._tag).toBe("ConstraintError");
    }
  });

  it("should return UnknownDbError", async () => {
    const result = await Effect.runPromiseExit(f(-1));
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(result.cause.value).toBeInstanceOf(UnknownDbError);
    }
  });
});
