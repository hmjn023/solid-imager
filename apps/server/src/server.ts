import { AsyncLocalStorage } from "node:async_hooks";
import {
	configureRequestLocale,
	type Locale,
	readLocaleCookie,
} from "@solid-imager/i18n";
import { API_PREFIX } from "@solid-imager/core/http";
import type { Register } from "@tanstack/solid-router";
import {
	createServerEntry,
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/solid-start/server";

const locale = new AsyncLocalStorage<Locale>();
configureRequestLocale(() => locale.getStore());
const handleRequest = createStartHandler(defaultStreamHandler);

export default createServerEntry<Register>({
	fetch: (request, options) =>
		locale.run(
			readLocaleCookie(request.headers.get("cookie") ?? "") ?? "ja",
			async () => {
				const { pathname } = new URL(request.url);
				if (pathname === API_PREFIX || pathname.startsWith(`${API_PREFIX}/`)) {
					const [{ handleApiRequest }, { startBackgroundWorker }] =
						await Promise.all([
							import("./infrastructure/api/http-handler"),
							import("./infrastructure/bootstrap"),
						]);
					return handleApiRequest(request, startBackgroundWorker);
				}
				return handleRequest(request, options ?? {});
			},
		),
});
