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

function BootstrapShell(props: { children: import("solid-js").JSX.Element }) {
	return (
		<div class="v2-theme flex min-h-screen min-h-[100dvh] flex-col bg-[var(--v2-canvas)] text-[var(--v2-text)]">
			<header class="flex h-13 shrink-0 items-center border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-4">
				<strong class="font-semibold">Solid Imager</strong>
			</header>
			<main class="flex-1">{props.children}</main>
		</div>
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
				<BootstrapShell>
					<BootstrapStatusScreen
						error={bootstrapError()}
						onRetry={initialize}
					/>
				</BootstrapShell>
			</Match>
			<Match when={state().status === "loading"}>
				<BootstrapShell>
					<BootstrapStatusScreen onRetry={initialize} />
				</BootstrapShell>
			</Match>
		</Switch>
	);
}

render(() => <App />, root);
