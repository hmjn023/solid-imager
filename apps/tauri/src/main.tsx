import { AppShell } from "@solid-imager/ui/layouts/app-shell";
import { BootstrapStatusScreen } from "@solid-imager/ui/router-status";
import { RouterProvider } from "@tanstack/solid-router";
import { createSignal, Match, onMount, Switch } from "solid-js";
import { render } from "solid-js/web";
import "./index.css";
import { initializeCollections } from "./collections";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Root container not found.");
}

const router = createAppRouter();

type BootstrapState =
	| { status: "loading" }
	| { status: "ready" }
	| { status: "error"; error: Error };

function toError(error: unknown): Error {
	return error instanceof Error
		? error
		: new Error("Unknown collection initialization error");
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
					<BootstrapStatusScreen
						error={bootstrapError()}
						onRetry={initialize}
					/>
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
