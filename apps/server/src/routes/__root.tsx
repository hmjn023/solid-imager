import { configureClientValidationLocale } from "@solid-imager/ui/validation-locale";
import { getLocale, migrateBrowserLocale, t } from "@solid-imager/i18n";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts";
import { Toaster } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/solid-router";
import { createSignal, onMount, type ParentProps, Show } from "solid-js";
import { HydrationScript, isServer } from "solid-js/web";
import styleCss from "~/app.css?url";
import { AppLayout } from "~/components/layout/layout";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries";
import type { RouteLoaderContext } from "~/infrastructure/router/route-types";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	headers: () => ({ "Cache-Control": "private, no-store" }),
	loader: async ({
		context,
		location,
	}: RouteLoaderContext & { location: { pathname: string } }) => {
		if (isServer && !isStandalonePath(location.pathname)) {
			await context.queryClient
				.query(mediaSourcesQueryOptions())
				.catch(() => undefined);
		}
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: t("sidebar.solidImager"),
			},
		],
		links: [{ rel: "stylesheet", href: styleCss }],
	}),
	shellComponent: RootDocument,
	component: RootComponent,
});

function isStandalonePath(pathname: string): boolean {
	return (
		pathname === "/design-lab" ||
		pathname.startsWith("/design-lab/") ||
		pathname === "/docs/scalar" ||
		pathname.startsWith("/docs/scalar/") ||
		pathname === "/docs/swagger" ||
		pathname.startsWith("/docs/swagger/")
	);
}

function RootDocument(props: ParentProps) {
	const [isHydrated, setIsHydrated] = createSignal(false);
	const location = useLocation();
	onMount(() => {
		if (migrateBrowserLocale()) {
			window.location.reload();
			return;
		}
		configureClientValidationLocale(getLocale());
		setIsHydrated(true);
	});

	return (
		<html
			data-hydrated={isHydrated() ? "true" : "false"}
			data-server-rendered=""
			lang={getLocale()}
		>
			<head>
				<HydrationScript />
				<HeadContent />
			</head>
			<body
				classList={{
					"workspace-theme": !isStandalonePath(location().pathname),
				}}
			>
				<ShortcutPreferencesProvider>
					<Toaster />
					{props.children}
				</ShortcutPreferencesProvider>
				<Scripts />
			</body>
		</html>
	);
}

function RootComponent() {
	const location = useLocation();
	return (
		<Show fallback={<Outlet />} when={!isStandalonePath(location().pathname)}>
			<AppLayout />
		</Show>
	);
}
