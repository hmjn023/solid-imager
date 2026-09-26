import { writeFile } from "node:fs/promises";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { appContract } from "@solid-imager/core/domain/contract";
import { openApiTags } from "../src/infrastructure/api/openapi-tags";

const generator = new OpenAPIGenerator({
	schemaConverters: [new ZodToJsonSchemaConverter()],
});

const document = await generator.generate(appContract, {
	info: {
		title: "Solid Imager oRPC API",
		version: "1.0.0",
		description: "Solid Imagerを管理するためのAPI仕様です。",
	},
	servers: [
		{
			url: "/api/rpc",
			description: "現在のAPIサーバー",
		},
	],
	tags: openApiTags,
});

await writeFile(
	new URL("../public/openapi.json", import.meta.url),
	`${JSON.stringify(document, null, 2)}\n`,
);
