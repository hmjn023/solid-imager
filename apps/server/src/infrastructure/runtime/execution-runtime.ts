export type ExecutionRuntime = "server" | "tauri" | "test";

export function getExecutionRuntime(): ExecutionRuntime {
	if (__TAURI_BUILD__) {
		return "tauri";
	}

	if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
		return "test";
	}

	return "server";
}
