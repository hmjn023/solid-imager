import { Effect } from "effect";
import { presets } from "~/infrastructure/db/schema";
import { ConstraintError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

type Preset = {
  id: string;
  name: string;
};

export const selectPresets = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(service(DatabaseService.Tag));
    return yield* _(
      Effect.tryPromise({
        try: async () => db.select().from(presets),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) => new UnknownDbError({ message: String(error) })
        )
      )
    );
  });

export const insertPreset = (preset: Preset) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(service(DatabaseService.Tag));
    return yield* _(
      Effect.tryPromise({
        try: async () => db.insert(presets).values(preset).returning(),
        catch: (error) => error,
      }).pipe(
        Effect.mapError((error) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "23505"
          ) {
            return new ConstraintError({ message: "Duplicate entry" });
          }
          return new UnknownDbError({ message: String(error) });
        })
      )
    );
  });
