const isDev = import.meta.env.DEV;
const FALLBACK_API_URL = "http://192.168.1.150:3000";

function normalizeUrl(value: string): string {
	const parsed = new URL(value.trim());
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("Server URL must use http or https.");
	}
	if (parsed.username || parsed.password) {
		throw new Error("Credentials must not be embedded in the server URL.");
	}
	parsed.hash = "";
	parsed.search = "";
	parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
	return parsed.toString().replace(/\/$/, "");
}

/** The configured server target, before a dev-server proxy is applied. */
export function getBuildTimeServerUrl(): string {
	return import.meta.env.VITE_API_URL || FALLBACK_API_URL;
}

/** Returns the same-origin proxy in development, otherwise the configured server URL. */
export function getBuildTimeApiBaseUrl(): string {
	if (isDev && typeof window !== "undefined") {
		return window.location.origin;
	}
	return getBuildTimeServerUrl();
}

let apiBaseUrl = getBuildTimeApiBaseUrl();

/** Returns the current request base URL, which may be the development proxy. */
export function getApiBaseUrl(): string {
	return apiBaseUrl;
}

/** Selects a normalized server URL, preserving the same-origin proxy for the default development target. */
export function setApiBaseUrl(value: string): void {
	const normalizedValue = normalizeUrl(value);
	if (
		isDev &&
		typeof window !== "undefined" &&
		normalizedValue === normalizeUrl(getBuildTimeServerUrl())
	) {
		// Keep the browser request on Vite's same-origin proxy while retaining the
		// real target URL in server settings for cache identity.
		apiBaseUrl = window.location.origin;
		return;
	}
	apiBaseUrl = normalizedValue;
}

/** Whether requests currently target the local development proxy. */
export function isDevelopmentProxy(): boolean {
	return (
		isDev &&
		typeof window !== "undefined" &&
		apiBaseUrl === window.location.origin
	);
}
