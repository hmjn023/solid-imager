# Quickstart: Using Effect-based Services

This guide provides a brief overview of how to use the newly refactored Effect-based services.

## Core Concepts

1.  **Effects are Programs**: Functions from services no longer return Promises. They return an `Effect`. An `Effect` is a blueprint for a program that describes what to do. It doesn't *do* anything until it is run.
2.  **Layers for Dependencies**: Services now declare their dependencies (like a database connection) in their type signature. You must provide these dependencies as a `Layer` when you run the effect.
3.  **Running Effects**: To execute an `Effect` and get a result, you use a runner like `Effect.runPromise` or `Effect.runSync`.

## Example Usage (in an API Route)

Here is how you would use the refactored `getMediaSources` function from within a SolidStart API route.

```typescript
// 1. Import necessary components from Effect and your services
import { Effect, Layer } from "effect";
import { getMediaSources } from "~/application/services/media-source-service"; // The refactored service
import { DatabaseLive } from "~/infrastructure/db/layer"; // The Layer providing the DB connection
import { DbError } from "~/infrastructure/db/errors";

export async function GET() {
  // 2. Define the program you want to run.
  // In this case, it's just getting the media sources.
  const program = getMediaSources;

  // 3. Provide the live implementation of the services the program needs.
  // The `getMediaSources` effect requires a `Database` service.
  const runnable = Effect.provide(program, DatabaseLive);

  // 4. Execute the effect and handle potential typed errors.
  try {
    const sources = await Effect.runPromise(runnable);
    return new Response(JSON.stringify(sources), { status: 200 });
  } catch (error) {
    if (error instanceof DbError) {
      console.error("ERROR: DbError in getMediaSources", error.cause);
      return new Response("Database Error", { status: 500 });
    }
    // Handle other potential errors
    console.error("ERROR: An unexpected error occurred", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
```
