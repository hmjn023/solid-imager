import { bootstrap, initServices } from "./bootstrap";

/**
 * Initializes dependencies used by file-route server handlers.
 *
 * In development, the Vite oRPC middleware owns the background worker
 * lifecycle and starts it once after the first RPC response. File-route
 * module graphs must therefore initialize services only, otherwise an image
 * or media request can create a second worker during initial rendering.
 */
export function bootstrapServerRoute(): void {
	if (import.meta.env.DEV) {
		initServices();
		return;
	}
	bootstrap();
}
