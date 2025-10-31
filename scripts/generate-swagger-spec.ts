import { promises as fs } from "node:fs";
import path from "node:path";
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Solid Imager API",
      version: "1.0.0",
      description: "API documentation for the Solid Imager application.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/api/**/*.ts", "./src/domain/**/*.ts"],
};

async function generateSwaggerSpec() {
  try {
    console.log("Generating Swagger API specification...");
    const spec = swaggerJsdoc(options);
    const outputPath = path.resolve(process.cwd(), "public/openapi.json");
    await fs.writeFile(outputPath, JSON.stringify(spec, null, 2));
    console.log(`API specification written to ${outputPath}`);
  } catch (error) {
    console.error("Error generating Swagger spec:", error);
    process.exit(1);
  }
}

void generateSwaggerSpec();
