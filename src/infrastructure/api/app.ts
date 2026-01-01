import fs from "node:fs/promises";
import type { OpenAPI } from "@orpc/contract";
import { OpenAPIGenerator } from "@orpc/openapi";
import { RPCHandler } from "@orpc/server/fetch";
import { Elysia } from "elysia";
import { MediaService } from "~/application/services/media-service";
import { appRouter } from "~/domain/shared/api-contract";
import { bootstrap } from "~/infrastructure/bootstrap";
import { getThumbnailPath } from "~/infrastructure/jobs/thumbnails";
import { logger } from "~/infrastructure/logger";
import { openApiTags } from "./openapi-tags";

// Initialize services (DI)
bootstrap();

const handler = new RPCHandler(appRouter);

// Generate OpenAPI spec for oRPC endpoints
const openApiGenerator = new OpenAPIGenerator();

// Mapping of router prefixes to tag names
const routerTagMap: Record<string, string> = {
  sources: "Media Sources",
  media: "Media",
  tags: "Tags",
  categories: "Categories",
  projects: "Projects",
  characters: "Characters",
  ips: "IPs",
  thumbnails: "Thumbnails",
  downloads: "Downloads",
  directories: "Directories",
  ai: "AI",
  utils: "Utilities",
};

/**
 * OpenAPIスペックにタグを自動割り当てする
 */
// biome-ignore lint/suspicious/noExplicitAny: OpenAPI spec object structure
function assignTags(spec: any) {
  if (!spec.paths) {
    return;
  }

  for (const pathItem of Object.values(spec.paths)) {
    if (!pathItem) {
      continue;
    }

    for (const method of ["get", "post", "put", "delete", "patch"] as const) {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic method access on OpenAPI paths
      const operation = (pathItem as any)[method] as
        | OpenAPI.OperationObject
        | undefined;
      if (operation?.operationId) {
        const routerName = operation.operationId.split(".")[0];
        const tagName = routerTagMap[routerName];

        if (tagName) {
          operation.tags = [tagName];
        }
      }
    }
  }
}

/**
 * Elysia アプリケーション
 */
export const app = new Elysia()
  // OpenAPI spec for oRPC endpoints
  .get("/api/openapi.json", async () => {
    const spec = await openApiGenerator.generate(appRouter, {
      info: {
        title: "Solid Imager oRPC API",
        version: "1.0.0",
        description:
          "API for managing media sources, media files, tags, and AI-powered features",
      },
      servers: [
        {
          url: "http://localhost:3000/api/rpc",
          description: "Development server (oRPC)",
        },
      ],
      tags: openApiTags,
    });

    assignTags(spec);

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
