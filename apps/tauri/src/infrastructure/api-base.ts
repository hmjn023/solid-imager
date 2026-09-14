const isDev = import.meta.env.DEV;

export function getBuildTimeApiBaseUrl(): string {
	if (isDev && typeof window !== "undefined") {
		return window.location.origin;
	}
	return import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";
}

let apiBaseUrl = getBuildTimeApiBaseUrl();

export function getApiBaseUrl(): string {
	return apiBaseUrl;
}

export function setApiBaseUrl(value: string): void {
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
	apiBaseUrl = parsed.toString().replace(/\/$/, "");
}

export function isDevelopmentProxy(): boolean {
	return (
		isDev &&
		typeof window !== "undefined" &&
		apiBaseUrl === window.location.origin
	);
}
