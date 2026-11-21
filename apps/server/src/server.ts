import { AsyncLocalStorage } from "node:async_hooks";
import {
	configureRequestLocale,
	type Locale,
	readLocaleCookie,
} from "@solid-imager/i18n";
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
			() => handleRequest(request, options ?? {}),
		),
});
