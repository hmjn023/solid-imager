/** Browser fixture replacement for the small native command surface. */
export function isTauri(): boolean {
	return Reflect.get(window, "isTauri") === true;
}

export async function invoke<T>(command: string): Promise<T> {
	if (command === "open_pixiv_login") {
		window.dispatchEvent(new Event(command));
		return undefined as T;
	}
	if (command === "remove_sqlite_database") {
		return undefined as T;
	}
	throw new Error(`Unsupported Tauri command in the E2E fixture: ${command}`);
}
