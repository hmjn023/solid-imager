import { createFileRoute } from "@tanstack/solid-router";
import page from "~/infrastructure/api/scalar.html?raw";
import openApi from "../../../../public/openapi.json?raw";
import { z } from "zod";
import { createServerOnlyFn } from "@tanstack/solid-start";

const render = createServerOnlyFn(() => {
	const document = JSON.parse(openApi);
	const outline = z
		.object({
			info: z.object({
				title: z.string(),
				version: z.string(),
				description: z.string(),
			}),
			paths: z.record(z.string(), z.record(z.string(), z.unknown())),
		})
		.parse(document);
	const methods = new Set([
		"get",
		"put",
		"post",
		"delete",
		"options",
		"head",
		"patch",
		"trace",
	]);
	const operations = Object.entries(outline.paths)
		.flatMap(([path, item]) =>
			Object.keys(item)
				.filter((method) => methods.has(method))
				.map(
					(method) =>
						`<li><code>${method.toUpperCase()} ${Bun.escapeHTML(path)}</code></li>`,
				),
		)
		.join("");
	return page
		.replace("<!--OPENAPI_JSON-->", () =>
			JSON.stringify(document).replaceAll("<", "\\u003c"),
		)
		.replace(
			"<!--OPENAPI_OUTLINE-->",
			() =>
				`<h1>${Bun.escapeHTML(outline.info.title)}</h1>
		<p>${Bun.escapeHTML(outline.info.description)} · ${Bun.escapeHTML(outline.info.version)}</p>
		<details><summary>API operations</summary><ul>${operations}</ul></details>`,
		);
});
let html: string | undefined;

export const Route = createFileRoute("/docs/scalar/")({
	server: {
		handlers: {
			GET: () =>
				new Response((html ??= render()), {
					headers: { "content-type": "text/html; charset=utf-8" },
				}),
		},
	},
});
