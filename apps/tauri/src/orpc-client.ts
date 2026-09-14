import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import {
	getApiBaseUrl,
	isDevelopmentProxy,
	setApiBaseUrl,
} from "~/infrastructure/api-base";

type FetchInit = RequestInit & { redirect?: Request["redirect"] };

function rewriteRequestUrl(request: Request): Request {
	const requestUrl = new URL(request.url);
	const baseUrl = new URL(getApiBaseUrl());
	const basePath = baseUrl.pathname.replace(/\/+$/, "");
	requestUrl.protocol = baseUrl.protocol;
	requestUrl.host = baseUrl.host;
	// `host` does not clear a port that was present on the placeholder URL
	// (the development client uses :1420). Copy the target port explicitly so
	// an origin without a port does not become `https://host:1420`.
	requestUrl.port = baseUrl.port;
	requestUrl.pathname = `${basePath}${requestUrl.pathname}` || "/";
	return new Request(requestUrl, request);
}

const dynamicFetch = (
	request: Request,
	init?: FetchInit,
): Promise<Response> => {
	const rewrittenRequest = rewriteRequestUrl(request);
	if (isDevelopmentProxy()) {
		return fetch(rewrittenRequest, init);
	}
	return tauriFetch(rewrittenRequest, init);
};

export const client = createClient<AppContract>({
	// The request URL is rewritten by dynamicFetch so the client can be
	// reconfigured after the settings store has been loaded.
	url: "http://127.0.0.1:1420",
	fetch: dynamicFetch,
});
export const orpc = client;

export function configureApiBaseUrl(baseUrl: string): void {
	setApiBaseUrl(baseUrl);
}
