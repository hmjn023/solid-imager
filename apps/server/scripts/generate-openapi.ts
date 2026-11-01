import { writeFile } from "node:fs/promises";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { appContract } from "@solid-imager/core/domain/contract";
import { REST_API_PREFIX } from "@solid-imager/core/domain/contract/http-paths";
import { openApiTags } from "../src/infrastructure/api/openapi-tags";

const generator = new OpenAPIGenerator({
	converters: [new ZodToJsonSchemaConverter()],
});

const document = await generator.generate(appContract, {
	version: "3.1.1",
	base: {
		info: {
			title: "Solid Imager oRPC API",
			version: "1.0.0",
			description: "Solid Imagerを管理するためのAPI仕様です。",
		},
		servers: [
			{
				url: REST_API_PREFIX,
				description: "現在のAPIサーバー",
			},
		],
		tags: openApiTags,
	},
});

await writeFile(
	new URL("../public/openapi.json", import.meta.url),
	`${JSON.stringify(document, null, 2)}\n`,
);
