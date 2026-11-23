import { SmartCoercionHandlerPlugin } from "@orpc/json-schema";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ORPCError } from "@orpc/server";
import {
	ResponseHeadersHandlerPlugin,
	type ResponseHeadersHandlerPluginContext,
} from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { API_PREFIX } from "@solid-imager/core/http";
import { handleMcpRequest } from "../mcp/http-handler";
import { appRouter } from "./app-router";
import { API_ERROR_STATUS } from "./http-errors";

interface ApiContext extends ResponseHeadersHandlerPluginContext {
	initialize: () => void;
	allowWrite: boolean;
	headers: Headers;
	pixivAuthorization?: string;
}

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
			"API_PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query or fragment",
		);
	}
	return url.origin;
}

const publicOrigin = readPublicOrigin(process.env.API_PUBLIC_ORIGIN);

function canSendWriteRequest(request: Request): boolean {
	const origin = request.headers.get("origin");
	const site = request.headers.get("sec-fetch-site");
	// A Chrome extension with host permission can already send requests to this server.
	if (origin && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return true;
	if (site === "cross-site" || site === "same-site") return false;
	return (
		site === "same-origin" ||
		origin === null ||
		origin === publicOrigin ||
		origin === new URL(request.url).origin
	);
}

const handler = new OpenAPIHandler<ApiContext>(appRouter, {
	errorStatusMap: API_ERROR_STATUS,
	plugins: [
		new ResponseHeadersHandlerPlugin(),
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		(options) => {
			const { context, path, request } = options;
			if (
				request.method !== "GET" &&
				request.method !== "HEAD" &&
				!context.allowWrite
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "Cross-origin request denied",
				});
			}
			if (path[0] !== "health") context.initialize();
			return options.next();
		},
	],
});

export async function handleApiRequest(
	request: Request,
	initialize: () => void,
): Promise<Response> {
	const pathname = new URL(request.url).pathname;
	if (pathname === `${API_PREFIX}/mcp` || pathname === `${API_PREFIX}/mcp/`) {
		return handleMcpRequest(request, initialize);
	}
	const { response } = await handler.handle(request, {
		prefix: API_PREFIX,
		context: {
			initialize,
			allowWrite: canSendWriteRequest(request),
			headers: request.headers,
			pixivAuthorization: request.headers.get("authorization") ?? undefined,
		},
	});
	if (!response) return new Response("Not Found", { status: 404 });
	if (!response.headers.has("cache-control")) {
		response.headers.set("cache-control", "no-store");
	}
	if (request.method !== "HEAD") return response;
	await response.body?.cancel();
	return new Response(null, {
		status: response.status,
		headers: response.headers,
	});
}
