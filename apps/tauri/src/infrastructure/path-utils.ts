export function joinLocalPath(...parts: string[]) {
	return parts.join("/").replace(/\/+/g, "/");
}
