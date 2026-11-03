import { getAsyncIteratorObjectSchemasDetails } from "@orpc/contract";
import {
	containsJsonFileSchema,
	isJsonObjectSchema,
	type JsonSchema,
} from "@orpc/json-schema";
import { getMcpToolMeta } from "@orpc/mcp";
import { getOpenAPIMeta } from "@orpc/openapi";
import {
	getRouter,
	Procedure,
	walkProcedureContractsSync,
	type AnyProcedure,
} from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import {
	viewToolTitles,
	type WebToolInfo,
} from "@solid-imager/core/domain/config/mcp";
import { isRestProcedure } from "@solid-imager/core/domain/contract/rest-visibility";
import { appRouter } from "~/infrastructure/api/app-router";

const converter = new ZodToJsonSchemaConverter({ cache: true });
const emptyInput = { type: "object", properties: {} } as const;

function buildCatalog() {
	const tools = new Map<
		string,
		{ info: WebToolInfo; procedure?: AnyProcedure }
	>();
	walkProcedureContractsSync(appRouter, (contract, path) => {
		const group = path[0];
		// Settings must not be able to publish themselves through a tool call.
		if (group === "config" || !isRestProcedure(contract)) return;
		const { inputSchemas = [], outputSchemas = [] } = contract["~orpc"];
		if (getAsyncIteratorObjectSchemasDetails(outputSchemas)) return;
		// Both surfaces accept JSON object arguments and finite JSON results.
		const [input] = inputSchemas;
		if (
			inputSchemas.length > 1 ||
			(input && !converter.condition(input, "input"))
		)
			return;
		const schema: JsonSchema = input
			? converter.convert(input, "input")[0]
			: emptyInput;
		if (!isJsonObjectSchema(schema) || containsJsonFileSchema(schema)) return;
		if (
			outputSchemas.some(
				(s) =>
					!converter.condition(s, "output") ||
					containsJsonFileSchema(converter.convert(s, "output")[0]),
			)
		)
			return;
		const procedure = getRouter(appRouter, path);
		if (!(procedure instanceof Procedure)) return;
		const meta = getOpenAPIMeta(contract);
		const mcp = getMcpToolMeta(procedure);
		const name =
			mcp?.name ??
			meta?.operationId ??
			(group === "tools" ? path.slice(1) : path).join("_");
		if (tools.has(name) || Object.hasOwn(viewToolTitles, name))
			throw new Error(`Duplicate MCP tool: ${name}`);
		tools.set(name, {
			procedure,
			info: {
				name,
				group,
				webOnly: false,
				title: mcp?.title ?? meta?.summary ?? name,
				description:
					mcp?.description ?? meta?.description ?? meta?.summary ?? name,
				inputSchema: schema,
				readOnly:
					mcp?.annotations?.readOnlyHint ??
					["GET", "HEAD", "QUERY"].includes(meta?.method ?? ""),
			},
		});
	});
	for (const [name, title] of Object.entries(viewToolTitles)) {
		tools.set(name, {
			info: {
				name,
				title,
				description: title,
				group: "WebMCP",
				webOnly: true,
				inputSchema: emptyInput,
				readOnly: name === "get_current_view",
			},
		});
	}
	return tools;
}

export const toolCatalog = buildCatalog();
export function catalogForSettings() {
	return Array.from(
		toolCatalog.values(),
		({ info: { name, title, group, webOnly } }) => ({
			name,
			title,
			group,
			webOnly,
		}),
	);
}
export function publishedWebTools(names: string[]) {
	return Array.from(toolCatalog.values(), (tool) => tool.info).filter((tool) =>
		names.includes(tool.name),
	);
}
