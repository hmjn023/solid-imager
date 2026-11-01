import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { REST_API_PREFIX } from "@solid-imager/core/domain/contract/http-paths";
import { isRestProcedure } from "@solid-imager/core/domain/contract/rest-visibility";
import { appRouter } from "./app-router";

const handler = new OpenAPIHandler(appRouter, {
	filter: isRestProcedure,
	plugins: [
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
	],
});

function readPublicOrigin(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const url = new URL(value);
	if (
		!["https:", "http:"].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.pathname !== "/" ||
		url.search ||
		url.hash
	) {
		throw new Error(
			"REST_PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment",
		);
	}
	return url.origin;
}
const publicOrigin = readPublicOrigin(process.env.REST_PUBLIC_ORIGIN);

export async function handleRestRequest(request: Request): Promise<Response> {
	// REST accepts HTML form submissions, including multipart uploads. Only the server's own
	// browser origin should be able to submit them. Non-browser clients normally omit Origin.
	const site = request.headers.get("sec-fetch-site");
	const origin = request.headers.get("origin");
	if (
		site === "cross-site" ||
		site === "same-site" ||
		(site !== "same-origin" &&
			origin !== null &&
			origin !== publicOrigin &&
			origin !== new URL(request.url).origin)
	) {
		return new Response("Cross-origin request denied", { status: 403 });
	}
	const { response } = await handler.handle(request, {
		prefix: REST_API_PREFIX,
	});
	return response ?? new Response("Not Found", { status: 404 });
}
