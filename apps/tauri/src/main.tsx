import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "../../server/src/app.css";
import { initializeTauriApp } from "./bootstrap";
import { router } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Tauri app root container was not found.");
}

initializeTauriApp();

render(() => <RouterProvider router={router} />, root);
