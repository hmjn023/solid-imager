import { BackgroundJobsCoordinator } from "@solid-imager/application/services/background-jobs-coordinator";
import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "./index.css";
import { setTauriAppServices } from "./app-services";
import { MaintenanceService } from "./application/services/maintenance-service";
import { initializeTauriApp, type TauriAppServices } from "./bootstrap";
import { tauriJobQueue } from "./infrastructure/jobs/tauri-job-queue";
import { TauriConfigService } from "./infrastructure/local-api/services/config-service";
import { TauriSourceService } from "./infrastructure/local-api/services/source-service";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Tauri app root container was not found.");
}

const appRoot = root;
const STARTUP_TIMEOUT_MS = 45_000;

function setStartupMessage(message: string) {
	console.log(`[Tauri] ${message}`);
	appRoot.textContent = message;
}

function createStartupTimeout(): Promise<never> {
	return new Promise((_, reject) => {
		window.setTimeout(() => {
			reject(
				new Error(
					"Timed out while initializing the Tauri app. The local database may be locked or unavailable.",
				),
			);
		}, STARTUP_TIMEOUT_MS);
	});
}

async function initializeWithTimeout() {
	return await Promise.race([
		initializeTauriApp({
			onStatus: setStartupMessage,
		}),
		createStartupTimeout(),
	]);
}

function renderStartupError(error: unknown) {
	const message =
		error instanceof Error ? error.stack || error.message : String(error);
	appRoot.replaceChildren();

	const container = document.createElement("div");
	container.setAttribute(
		"style",
		"padding: 2rem; background: white; color: black; font-family: sans-serif;",
	);

	const title = document.createElement("h1");
	title.setAttribute(
		"style",
		"color: #ef4444; font-size: 1.5rem; margin-bottom: 1rem;",
	);
	title.textContent = "Initialization Error";

	const description = document.createElement("p");
	description.setAttribute("style", "margin-bottom: 1rem;");
	description.textContent = "The Tauri application failed to start.";

	const details = document.createElement("pre");
	details.setAttribute(
		"style",
		"background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; font-size: 0.875rem;",
	);
	details.textContent = message;

	const reloadButton = document.createElement("button");
	reloadButton.setAttribute(
		"style",
		"margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;",
	);
	reloadButton.textContent = "Reload Application";
	reloadButton.addEventListener("click", () => window.location.reload());

	container.append(title, description, details, reloadButton);
	appRoot.append(container);
}

function startBackgroundServices(services: TauriAppServices) {
	if (!services.localDatabaseAvailable) {
		console.warn(
			"Tauri database-backed background services are disabled because the local database is unavailable.",
		);
		return;
	}

	void (async () => {
		const coordinator = new BackgroundJobsCoordinator({
			loadConfig: async () => await services.apiClient.config.get(),
			onConfigChange: (listener) => {
				TauriConfigService.onChange((config) => {
					void listener(config);
				});
			},
			updateWorkerConfig: (config) => {
				tauriJobQueue.updateConfig(config);
			},
			resetRunnableJobs: async () => {
				await tauriJobQueue.resetRunnableJobs();
			},
			startWorker: () => {
				tauriJobQueue.start();
			},
			startWatchingAllSources: async () => {
				await TauriSourceService.startWatchingAllLocalSources();
			},
			performStartupChecks: async ({ afterJobsQueued }) => {
				await new MaintenanceService({
					afterJobsQueued: async (sourceIds) => {
						await tauriJobQueue.initialize();
						tauriJobQueue.registerQueuedSources(sourceIds);
						await afterJobsQueued(sourceIds);
					},
				}).performStartupChecks();
			},
		});
		await coordinator.start();
	})().catch((error: unknown) => {
		console.error("Failed to start Tauri background services", error);
	});
}

async function main() {
	setStartupMessage("Initializing application...");
	const services = await initializeWithTimeout();
	setStartupMessage("Services initialized.");
	setTauriAppServices(services);

	const router = createAppRouter(services);
	setStartupMessage("Rendering application...");

	appRoot.replaceChildren();
	render(() => <RouterProvider router={router} />, appRoot);
	startBackgroundServices(services);
}

void main().catch((error: unknown) => {
	console.error("Failed to initialize Tauri app", error);
	renderStartupError(error);
});
