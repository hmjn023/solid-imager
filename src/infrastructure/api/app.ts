import fs from "node:fs/promises";
import { swagger } from "@elysiajs/swagger";
import { OpenAPIGenerator } from "@orpc/openapi";
import { RPCHandler } from "@orpc/server/fetch";
import { Elysia } from "elysia";
import { MediaService } from "~/application/services/media-service";
import { appRouter } from "~/domain/shared/api-contract";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";

const handler = new RPCHandler(appRouter);

// Generate OpenAPI spec for oRPC endpoints
const openApiGenerator = new OpenAPIGenerator();

/**
 * Elysia アプリケーション
 */
export const app = new Elysia()
  .use(
    swagger({
      documentation: {
        info: {
          title: "Solid Imager API",
          version: "1.0.0",
          description:
            "API documentation for Solid Imager (Binary endpoints only. oRPC endpoints are documented at /api/openapi.json)",
        },
        servers: [
          {
            url: "http://localhost:3000",
            description: "Development server",
          },
        ],
      },
    })
  )
  // OpenAPI spec for oRPC endpoints
  .get("/api/openapi.json", async () => {
    const spec = await openApiGenerator.generate(appRouter, {
      info: {
        title: "Solid Imager oRPC API",
        version: "1.0.0",
        description: "oRPC endpoints for Solid Imager",
      },
      servers: [
        {
          url: "http://localhost:3000/api/rpc",
          description: "Development server (oRPC)",
        },
      ],
    });
    return spec;
  })
  // Media Content
  .get(
    "/api/sources/:mediaSourceId/:mediaId",
    async ({ params: { mediaSourceId, mediaId } }) => {
      try {
        const buffer = await MediaService.getMediaContent(
          mediaSourceId,
          mediaId
        );
        return new Response(buffer as unknown as BodyInit, { status: 200 });
      } catch (error) {
        logger.error({ err: error, mediaId }, "Failed to serve media content");
        return new Response("Media not found", { status: 404 });
      }
    }
  )
  // Thumbnails
  .get(
    "/api/sources/:mediaSourceId/:mediaId/thumbnail",
    async ({ params: { mediaSourceId, mediaId } }) => {
      try {
        const thumbnailPath = getThumbnailPath(mediaSourceId, mediaId);
        try {
          await fs.access(thumbnailPath);
        } catch {
          return new Response("Thumbnail not found", { status: 404 });
        }

        const thumbnailBuffer = await fs.readFile(thumbnailPath);
        return new Response(thumbnailBuffer, {
          headers: { "Content-Type": "image/webp" },
        });
      } catch (error) {
        logger.error({ err: error, mediaId }, "Failed to serve thumbnail");
        return new Response("Thumbnail error", { status: 500 });
      }
    }
  )
  .all(
    "/*",
    async ({ request }: { request: Request }) => {
      const { response } = await handler.handle(request, {
        prefix: "/api/rpc",
      });
      return response ?? new Response("Not Found", { status: 404 });
    },
    {
      parse: "none", // Disable Elysia body parser to prevent "body already used" error
    }
  );
