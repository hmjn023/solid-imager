import { promises as fs } from "node:fs";
import path from "node:path";
import { OpenAPIGenerator } from "@orpc/openapi";
import { appRouter } from "../src/domain/shared/api-contract";
import { openApiTags } from "../src/infrastructure/api/openapi-tags";

async function generateOpenAPISpec() {
  try {
    console.log("Generating OpenAPI specification from oRPC router...");

    const generator = new OpenAPIGenerator();
    const spec = await generator.generate(appRouter, {
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

    const outputPath = path.resolve(process.cwd(), "public/openapi.json");
    await fs.writeFile(outputPath, JSON.stringify(spec, null, 2));
    console.log(`OpenAPI specification written to ${outputPath}`);
  } catch (error) {
    console.error("Error generating OpenAPI spec:", error);
    process.exit(1);
  }
}

void generateOpenAPISpec();
