# Phase 0: Research on Effect.ts Integration

## 1. Dependency Injection (DI) with Layers

The core of our integration will rely on Effect's `Layer` for dependency injection. This allows us to provide services like the database connection in a type-safe and composable manner.

### Strategy:

1.  **Database Service Tag**: We will define a `Tag` for our database service. A tag is a unique identifier for a service in Effect's context.

    ```typescript
    import { Context } from "effect";
    import { type DrizzleD1Database } from "drizzle-orm/d1"; // Assuming D1 or similar

    export class Database extends Context.Tag("DatabaseService")<
      Database,
      {
        readonly db: DrizzleD1Database;
      }
    >() {}
    ```

2.  **Live Implementation (Layer)**: We will create a "live" layer that provides the actual implementation of the database service. This layer will be responsible for creating the Drizzle instance using the `pg.Pool` from our existing setup.

    ```typescript
    import { Layer } from "effect";
    import { drizzle } from "drizzle-orm/node-postgres";
    import { pool } from "~/infrastructure/db"; // Existing pool
    import { Database } from "./tag"; // The Tag defined above

    export const DatabaseLive = Layer.succeed(
      Database,
      Database.of({
        db: drizzle(pool),
      })
    );
    ```

## 2. Error Handling

Per the feature specification, we will start with a single generic `DbError`.

### Strategy:

1.  **Define a Tagged Error**: We will create a class-based, tagged error to represent database failures. This allows us to catch specific error types in our Effect programs.

    ```typescript
    import { Data } from "effect";

    export class DbError extends Data.TaggedError("DbError")<{
      readonly cause: unknown;
    }> {}
    ```

2.  **Wrapping DB Calls**: All database calls will be wrapped with `Effect.tryPromise`, and any potential errors will be mapped to our `DbError`.

    ```typescript
    import { Effect } from "effect";
    import { db } from "~/infrastructure/db";
    import { DbError } from "./errors";

    const getSources = Effect.tryPromise({
      try: () => db.select().from(mediaSources),
      catch: (unknown) => new DbError({ cause: unknown }),
    });
    ```

## 3. API Boundary (SolidStart Routes)

The API routes are the "edge of the world" where we will execute our Effect programs and translate the results (success or failure) into HTTP responses.

### Strategy:

1.  **Program Definition**: The entire logic for an endpoint will be composed into a single `Effect` program. This program will require the `Database` service from its context.

    ```typescript
    // In media-source-service.ts
    import { Effect } from "effect";
    import { Database, DbError } from "../db";

    export const getMediaSources = Effect.withDo(function* () {
      const db = yield* Database;
      const sources = yield* Effect.tryPromise({
        try: () => db.db.select().from(mediaSources),
        catch: (unknown) => new DbError({ cause: unknown }),
      });
      return sources;
    });
    ```

2.  **Program Execution**: In the API route file, we will provide the live implementation of our services (the `DatabaseLive` layer) and run the program using `Effect.runPromise`.

    ```typescript
    // In src/routes/api/sources/index.ts
    import { Effect, Layer } from "effect";
    import { getMediaSources } from "~/application/services/media-source-service";
    import { DatabaseLive } from "~/infrastructure/db/layer";

    export async function GET() {
      const program = getMediaSources;
      const runnable = Effect.provide(program, DatabaseLive);

      try {
        const sources = await Effect.runPromise(runnable);
        return new Response(JSON.stringify(sources), { status: 200 });
      } catch (error) {
        // Per spec, log a one-line summary
        console.error(`ERROR: Failed to get media sources`, error);
        return new Response("Internal Server Error", { status: 500 });
      }
    }
    ```
