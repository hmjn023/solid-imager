export function initializeTauriApp() {
	if (typeof document === "undefined") {
		return;
	}

	document.documentElement.dataset.platform = "tauri";
}
