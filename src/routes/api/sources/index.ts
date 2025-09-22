import type { APIEvent } from "@solidjs/start/server";
import { createMediaSource, getMediaSources } from "~/lib/api/sources";

/**
 *
 * @returns すべてのメディアソース
 */

export async function GET() {
	const sources = await getMediaSources();
	return sources;
}

/**
 * メディアソースを作成します。
 *
 * @returns 作成されたメディアソース
 */
export async function POST({ request }: APIEvent) {
	const { name, description, type, connectionInfo } = await request.json();
	const newSource = await createMediaSource({
		name,
		description,
		type,
		connectionInfo,
	});
	return newSource;
}
