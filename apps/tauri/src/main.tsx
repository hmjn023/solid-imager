import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "./index.css";
import { createAppRouter } from "./router";
import { initializeCollections } from "./collections";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Root container not found.");
}

const router = createAppRouter();

initializeCollections().then(() => {
	render(() => <RouterProvider router={router} />, root);
});
