declare module "swagger-ui-dist/swagger-ui-bundle.js";

interface ImportMetaEnv {
	readonly VITE_TAURI?: string;
}

declare const __TAURI_BUILD__: boolean;
declare const __TAURI_SPA__: boolean;
