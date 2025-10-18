import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { ips } from "~/infrastructure/db/schema";
import { ConstraintError, NotFoundError, UnknownDbError } from "./errors";
import { DatabaseService } from "./layer";

export const selectIps = () =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.select().from(ips),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: "Failed to select IPs",
              details: error,
            })
        )
      )
    );
  });

export const insertIp = (ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    return yield* _(
      Effect.tryPromise({
        try: () => db.insert(ips).values(ipData).returning(),
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
              message: "IP with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: "Failed to insert IP",
            details: error,
          });
        })
      )
    );
  });

export const selectIpById = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () => db.select().from(ips).where(eq(ips.id, ipId)),
        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to select IP by ID: ${ipId}`,
              details: error,
            })
        )
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }
    return result[0];
  });

export const updateIp = (ipId: number, ipData: unknown) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);
    const result = yield* _(
      Effect.tryPromise({
        try: () =>
          db.update(ips).set(ipData).where(eq(ips.id, ipId)).returning(),
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
              message: "IP with this name already exists",
              details: error,
            });
          }
          return new UnknownDbError({
            message: `Failed to update IP with ID: ${ipId}`,
            details: error,
          });
        })
      )
    );
    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }
    return result[0];
  });

export const deleteIp = (ipId: number) =>
  Effect.gen(function* (_) {
    const { db } = yield* _(DatabaseService);

    const result = yield* _(
      Effect.tryPromise({
        try: () => db.delete(ips).where(eq(ips.id, ipId)).returning(),

        catch: (error) => error,
      }).pipe(
        Effect.mapError(
          (error) =>
            new UnknownDbError({
              message: `Failed to delete IP with ID: ${ipId}`,

              details: error,
            })
        )
      )
    );

    if (result.length === 0) {
      return yield* _(
        Effect.fail(
          new NotFoundError({ message: `IP with ID ${ipId} not found` })
        )
      );
    }

    return result[0];
  });
