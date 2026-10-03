/** Browser fixture replacement for the small native command surface. */
export async function invoke<T>(command: string): Promise<T> {
	if (command === "remove_sqlite_database") {
		return undefined as T;
	}
	throw new Error(`Unsupported Tauri command in the E2E fixture: ${command}`);
}
