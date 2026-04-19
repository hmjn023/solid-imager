import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "./index.css";
import { setTauriAppServices } from "./app-services";
import { initializeTauriApp } from "./bootstrap";
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

function startBackgroundServices() {
	console.warn(
		"Tauri database-backed background services are disabled during startup.",
	);
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
	startBackgroundServices();
}

void main().catch((error: unknown) => {
	console.error("Failed to initialize Tauri app", error);
	renderStartupError(error);
});
