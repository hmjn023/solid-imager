import { orpc } from "./orpc-client";

export function fetchTags() {
	return orpc.tags.list();
}
