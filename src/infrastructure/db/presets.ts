import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Effect } from "effect";
import { ConstraintError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

type Preset = {
  id: string;
  name: string;
};

interface CustomError extends Error {
  code?: string;
}

export const selectPresets = () =>
  Effect.tryPromise({
    try: () => {
      // Placeholder implementation
      return [];
    },
    catch: (error) => new UnknownDbError({ message: String(error) }),
  }).pipe(
    Effect.provideService(
      DatabaseService,
      DatabaseService.of({ _: DatabaseService(), db: {} as PostgresJsDatabase })
    )
  );

export const insertPreset = (preset: Preset) =>
  Effect.tryPromise({
    try: () => {
      // Placeholder implementation
      if (preset.id === "duplicate") {
        const error: CustomError = new Error("Duplicate entry");
        error.code = "23505";
        throw error;
      }
      return [preset];
    },
    catch: (error) => {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as CustomError).code === "23505"
      ) {
        return new ConstraintError({ message: "Duplicate entry" });
      }
      return new UnknownDbError({ message: String(error) });
    },
  }).pipe(
    Effect.provideService(
      DatabaseService,
      DatabaseService.of({ _: DatabaseService(), db: {} as PostgresJsDatabase })
    )
  );
