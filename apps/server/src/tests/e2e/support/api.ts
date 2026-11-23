import type {
	APIRequestContext,
	Page,
	Request,
	Response,
	Route,
} from "@playwright/test";
import { getProcedureContractOrThrow } from "@orpc/contract";
import { getOpenAPIMeta, OpenAPISerializer } from "@orpc/openapi";
import { OpenAPILinkCodec } from "@orpc/openapi/standard";
import { walkProcedureContractsSync } from "@orpc/server";
import { appContract } from "@solid-imager/core/contract";
import { API_PREFIX } from "@solid-imager/core/http";

const serializer = new OpenAPISerializer();
const codec = new OpenAPILinkCodec(appContract, {
	url: API_PREFIX,
	serializer,
});
const literalPaths = new Map<string, Set<string>>();
walkProcedureContractsSync(appContract, (procedure) => {
	const meta = getOpenAPIMeta(procedure);
	if (meta?.method && meta.path && !meta.path.includes("{")) {
		const paths = literalPaths.get(meta.method) ?? new Set<string>();
		paths.add(API_PREFIX + meta.path);
		literalPaths.set(meta.method, paths);
	}
});

function apiOperation(operation: string) {
	const procedure = getProcedureContractOrThrow(
		appContract,
		operation.split("/"),
	);
	const meta = getOpenAPIMeta(procedure);
	if (!meta?.path || !meta.method)
		throw new Error(`Missing HTTP route for ${operation}`);
	return { method: meta.method, path: API_PREFIX + meta.path };
}

function escapeRegex(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routePattern(path: string): string {
	return path
		.split("/")
		.map((segment) => {
			const parameter = /^\{([a-zA-Z]\w*)\}$/.exec(segment)?.[1];
			return parameter ? `(?<${parameter}>[^/?#]+)` : escapeRegex(segment);
		})
		.join("/");
}

export function apiPathPattern(operation: string): RegExp {
	const { method, path } = apiOperation(operation);
	const pattern = routePattern(path);
	const routeEnd = "(?=[?#]|$)";
	if (!path.includes("{")) return new RegExp(`${pattern}${routeEnd}`);
	const matchingLiterals = [...(literalPaths.get(method) ?? [])].filter(
		(literal) => new RegExp(`^${pattern}$`).test(literal),
	);
	const exclude = matchingLiterals.length
		? `(?!${matchingLiterals.map((literal) => `${escapeRegex(literal)}${routeEnd}`).join("|")})`
		: "";
	return new RegExp(`${exclude}${pattern}${routeEnd}`);
}

export function apiRoute(operation: string): (url: URL) => boolean {
	const pattern = apiPathPattern(operation);
	return (url) => pattern.test(url.pathname);
}

export function apiRequestMatches(
	operation: string,
): (request: Request) => boolean {
	const { method } = apiOperation(operation);
	const matches = apiRoute(operation);
	return (request) =>
		request.method() === method && matches(new URL(request.url()));
}

export function apiResponse(
	operation: string,
): (response: Response) => boolean {
	const matches = apiRequestMatches(operation);
	return (response) => matches(response.request());
}

export async function routeApi(
	page: Page,
	operation: string,
	handler: (route: Route) => void | Promise<void>,
): Promise<void> {
	const { method } = apiOperation(operation);
	await page.route(apiPathPattern(operation), (route) =>
		route.request().method() === method ? handler(route) : route.fallback(),
	);
}

export function apiRequestInput<T = Record<string, unknown>>(
	request: Request,
	operation: string,
): T {
	const url = new URL(request.url());
	const groups = apiPathPattern(operation).exec(url.pathname)?.groups;
	const params = Object.fromEntries(
		Object.entries(groups ?? {}).map(([key, value]) => [
			key,
			decodeURIComponent(value),
		]),
	);
	const body =
		request.method() === "GET" || request.method() === "HEAD"
			? serializer.deserialize(url.searchParams)
			: request.postDataJSON();
	return { ...body, ...params } as T;
}

export async function apiRequest(
	request: Pick<APIRequestContext, "fetch">,
	operation: string,
	input: Record<string, unknown> = {},
	baseUrl = "",
	options: { timeout?: number } = {},
) {
	const encoded = await codec.encodeInput(input, operation.split("/"), {
		context: {},
	});
	const headers: Record<string, string> = {};
	for (const [name, value] of Object.entries(encoded.headers)) {
		if (value !== undefined) {
			headers[name] = Array.isArray(value) ? value.join(", ") : value;
		}
	}
	return request.fetch(baseUrl + encoded.url, {
		...options,
		method: encoded.method,
		headers,
		...(encoded.body instanceof FormData
			? { multipart: encoded.body }
			: { data: encoded.body }),
	});
}
