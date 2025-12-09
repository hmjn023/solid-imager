# 09 - API Documentation (Swagger)

This document outlines how the API documentation is generated, maintained, and served using Swagger UI.

## 1. Overview

We use `swagger-jsdoc` to generate an OpenAPI 3.0 specification from JSDoc comments embedded directly in our API route handlers. This specification is then served via a dedicated page using `swagger-ui-dist`.

This approach keeps the documentation close to the code, making it easier to maintain and keep in sync with the actual API implementation.

## 2. Key Technologies

-   **`swagger-jsdoc`**: Reads JSDoc annotations from source files and generates an `openapi.json` specification.
-   **`swagger-ui-dist`**: A dependency-free module that provides the static assets (HTML, JS, CSS) to render the Swagger UI.

## 3. How It Works

### 3.1. Specification Generation

-   A script located at `scripts/generate-swagger-spec.ts` is responsible for orchestrating the generation process.
-   This script uses `swagger-jsdoc` to scan all files matching `src/routes/api/**/*.ts` and `src/domain/**/*.ts` for JSDoc blocks formatted as OpenAPI definitions.
-   Running the script generates a static `public/openapi.json` file.

### 3.2. Serving the UI

-   A dedicated route at `http://localhost:3000/docs/swagger` serves the API documentation.
-   The page is rendered by `src/routes/docs/swagger/index.tsx`.
-   To avoid issues with Server-Side Rendering (SSR), it uses SolidStart's `clientOnly` utility to dynamically import and render the `src/components/swagger-ui.tsx` component only on the client.
-   The `swagger-ui.tsx` component initializes the Swagger UI, pointing it to the `/openapi.json` file.

## 4. How to Update the Documentation

### Step 1: Annotate Your API Route

To document an endpoint, add a JSDoc block above the route handler (`GET`, `POST`, etc.). The block must follow the [OpenAPI 3.0 Specification](https://swagger.io/specification/).

**Example from `src/routes/api/sources/index.ts`:**

```typescript
/**
 * @swagger
 * /api/sources:
 *   get:
 *     summary: Retrieve all media sources
 *     description: Fetches a list of all configured media sources.
 *     tags:
 *       - Media Sources
 *     responses:
 *       200:
 *         description: A list of media sources.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MediaSource'
 */
export async function GET() {
  // ... handler logic
}
```

### Step 2: Define Reusable Schemas

If your endpoint uses complex objects for requests or responses, it's best to define them as reusable schemas.

All shared schemas should be defined in `src/domain/shared/api-spec.ts`.

**Example from `src/domain/shared/api-spec.ts`:**

```typescript
/**
 * @swagger
 * components:
 *   schemas:
 *     MediaSource:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *     NewMediaSource:
 *       type: object
 *       required:
 *         - name
 *         - type
 *       properties:
 *         name:
 *           type: string
 */
```

### Step 3: Regenerate the Specification

After adding or updating your JSDoc annotations, run the following command to update the `public/openapi.json` file:

```bash
bun run gen:spec
```

This command should be run whenever API definitions change. The updated documentation will be available immediately after regeneration (you may need to refresh the Swagger UI page).
