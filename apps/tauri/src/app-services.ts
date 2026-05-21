import type { TauriAppServices } from "./bootstrap";

let services: TauriAppServices | null = null;

export function setTauriAppServices(next: TauriAppServices) {
	services = next;
}

export function getTauriAppServices() {
	if (!services) {
		throw new Error("Tauri app services have not been initialized.");
	}
	return services;
}
