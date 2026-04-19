import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "../../server/src/app.css";
import { setTauriAppServices } from "./app-services";
import { MaintenanceService } from "./application/services/maintenance-service";
import { initializeTauriApp } from "./bootstrap";
import { tauriJobQueue } from "./infrastructure/jobs/tauri-job-queue";
import { TauriSourceService } from "./infrastructure/local-api/services/source-service";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Tauri app root container was not found.");
}

const appRoot = root;

async function main() {
	const services = await initializeTauriApp();
	setTauriAppServices(services);
	await tauriJobQueue.initialize();

	// Run maintenance in background to avoid blocking startup
	const maintenance = new MaintenanceService();
	void maintenance.performStartupChecks().catch((error: unknown) => {
		console.error("Failed to run Tauri maintenance", error);
	});

	const router = createAppRouter(services);

	render(() => <RouterProvider router={router} />, appRoot);

	void TauriSourceService.startWatchingAllLocalSources().catch(
		(error: unknown) => {
			console.error("Failed to start Tauri source watchers", error);
		},
	);
}

void main().catch((error: unknown) => {
	console.error("Failed to initialize Tauri app", error);
	appRoot.textContent =
		error instanceof Error ? error.message : "Failed to initialize Tauri app.";
});
