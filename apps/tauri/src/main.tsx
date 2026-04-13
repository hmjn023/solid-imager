import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "../../server/src/app.css";
import { setTauriAppServices } from "./app-services";
import { initializeTauriApp } from "./bootstrap";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Tauri app root container was not found.");
}

async function main() {
	const services = await initializeTauriApp();
	setTauriAppServices(services);
	const router = createAppRouter(services);

	render(() => <RouterProvider router={router} />, root!);
}

void main().catch((error: unknown) => {
	console.error("Failed to initialize Tauri app", error);
	root.textContent =
		error instanceof Error ? error.message : "Failed to initialize Tauri app.";
});
