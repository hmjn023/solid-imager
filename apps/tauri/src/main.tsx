import { RouterProvider } from "@tanstack/solid-router";
import { render } from "solid-js/web";
import "./index.css";
import { initializeCollections } from "./collections";
import { createAppRouter } from "./router";

const root = document.getElementById("app");

if (!root) {
	throw new Error("Root container not found.");
}

const router = createAppRouter();

initializeCollections().then(() => {
	render(() => <RouterProvider router={router} />, root);
});
