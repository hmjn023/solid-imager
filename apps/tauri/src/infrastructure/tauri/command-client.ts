export type TauriCommandClient = {
	invoke<TResponse>(command: string, payload?: Record<string, unknown>): Promise<TResponse>;
};

type TauriInvoke = <TResponse>(
	command: string,
	payload?: Record<string, unknown>,
) => Promise<TResponse>;

declare global {
	interface Window {
		__TAURI_INTERNALS__?: {
			invoke?: TauriInvoke;
		};
		__TAURI__?: {
			core?: {
				invoke?: TauriInvoke;
			};
		};
	}
}

function resolveInvoke(): TauriInvoke {
	if (typeof window === "undefined") {
		throw new Error("Tauri command client is only available in the browser.");
	}

	const invoke = window.__TAURI_INTERNALS__?.invoke ?? window.__TAURI__?.core?.invoke;

	if (!invoke) {
		throw new Error("Tauri runtime is not available. Launch this app inside the Tauri shell.");
	}

	return invoke;
}

export function createTauriCommandClient(): TauriCommandClient {
	const invoke = resolveInvoke();

	return {
		invoke<TResponse>(command: string, payload?: Record<string, unknown>) {
			return invoke<TResponse>(command, payload);
		},
	};
}
