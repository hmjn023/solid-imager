import { z } from "zod";

const defaultHttpTools = [
	"list_sources",
	"create_local_source",
	"search_media",
	"get_media_details",
	"find_tags",
	"edit_media_tags",
];
export const viewToolTitles = {
	get_current_view: "現在の画面を確認",
	open_media: "画像の詳細を表示",
};
const defaultWebTools = [
	...defaultHttpTools.filter((name) => name !== "get_media_details"),
	...Object.keys(viewToolTitles),
];
const toolNames = z.array(z.string().min(1));
/** Partial replacement of the enabled HTTP and web tool name lists. */
export const mcpConfigUpdateSchema = z
	.object({ http: toolNames, web: toolNames })
	.partial();
/** Enabled tool names per transport, with defaults applied to omitted lists. */
export const mcpConfigSchema = z.object({
	http: toolNames.default(defaultHttpTools),
	web: toolNames.default(defaultWebTools),
});
export type McpConfig = z.infer<typeof mcpConfigSchema>;
export const mcpToolInfoSchema = z.object({
	name: z.string(),
	title: z.string(),
	group: z.string(),
	webOnly: z.boolean(),
});
export type McpToolInfo = z.infer<typeof mcpToolInfoSchema>;
/** Web-exposed tool metadata, including its input schema and read-only annotation. */
export const webToolInfoSchema = mcpToolInfoSchema.extend({
	description: z.string(),
	inputSchema: z.record(z.string(), z.unknown()),
	readOnly: z.boolean(),
});
export type WebToolInfo = z.infer<typeof webToolInfoSchema>;
