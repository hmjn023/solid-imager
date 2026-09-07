import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { BootstrapStatusScreen } from "@solid-imager/ui/router-status";
import { RouterProvider } from "@tanstack/solid-router";
import { createSignal, Match, onMount, Switch } from "solid-js";
import { render } from "solid-js/web";
import "./index.css";
import { initializeCollections } from "./collections";
import { ServerSettingsScreen } from "./components/server-settings-screen";
import {
	getActiveServer,
	getServerSettings,
	initializeServerSettings,
	type ServerSettings,
} from "./infrastructure/settings/server-settings";
import { configureApiBaseUrl } from "./orpc-client";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Root container not found.");
}

const router = createAppRouter();

type BootstrapState =
	| { status: "loading" }
	| { status: "needs-server"; settings: ServerSettings }
	| { status: "ready" }
	| { status: "error"; error: Error };

function toError(error: unknown): Error {
	return error instanceof Error
		? error
		: new Error("Unknown collection initialization error");
}

function getSetupSettings(state: BootstrapState): ServerSettings | null {
	return state.status === "needs-server" ? state.settings : null;
}

function getStoredSettings(): ServerSettings | null {
	try {
		return getServerSettings();
	} catch {
		return null;
	}
}

function BootstrapNav() {
	return (
		<header class="border-border border-b bg-background px-4 py-3">
			<span class="font-semibold">Solid Imager</span>
		</header>
	);
}

function App() {
	const [state, setState] = createSignal<BootstrapState>({
		status: "loading",
	});
	let initializationId = 0;

	const initialize = async () => {
		const currentId = ++initializationId;
		setState({ status: "loading" });

		try {
			const settings = await initializeServerSettings();
			const activeServer = getActiveServer();
			if (!activeServer) {
				if (currentId === initializationId) {
					setState({ status: "needs-server", settings });
				}
				return;
			}
			configureApiBaseUrl(activeServer.baseUrl);
			await initializeCollections();
			if (currentId === initializationId) {
				setState({ status: "ready" });
			}
		} catch (error) {
			if (currentId === initializationId) {
				setState({ status: "error", error: toError(error) });
			}
		}
	};

	onMount(() => {
		void initialize();
	});

	const bootstrapError = () => {
		const currentState = state();
		return currentState.status === "error" ? currentState.error : undefined;
	};

	return (
		<Switch>
			<Match when={state().status === "ready"}>
				<RouterProvider router={router} />
			</Match>
			<Match when={state().status === "error"}>
				<AppShell nav={<BootstrapNav />}>
					<div class="grid gap-6">
						<BootstrapStatusScreen
							error={bootstrapError()}
							onRetry={initialize}
						/>
						<Match when={getStoredSettings()}>
							{(settings) => (
								<ServerSettingsScreen
									initialSettings={settings()}
									onActivate={async () => {
										// A retry can have already initialized collections and their
										// SQLite persistence for the previous server. Reload so the
										// target and cache scope are both rebuilt from scratch.
										window.location.reload();
									}}
									onNoActiveServer={initialize}
								/>
							)}
						</Match>
					</div>
				</AppShell>
			</Match>
			<Match when={state().status === "needs-server"}>
				<AppShell nav={<BootstrapNav />}>
					<Match when={getSetupSettings(state())}>
						{(settings) => (
							<ServerSettingsScreen
								initialSettings={settings()}
								onActivate={async (server) => {
									configureApiBaseUrl(server.baseUrl);
									await initializeCollections();
									setState({ status: "ready" });
								}}
							/>
						)}
					</Match>
				</AppShell>
			</Match>
			<Match when={state().status === "loading"}>
				<AppShell nav={<BootstrapNav />}>
					<BootstrapStatusScreen onRetry={initialize} />
				</AppShell>
			</Match>
		</Switch>
	);
}

render(() => <App />, root);
