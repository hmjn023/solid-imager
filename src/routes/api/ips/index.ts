import type { APIEvent } from "@solidjs/start/server";
import { createIp, getIps } from "~/lib/api/ips";

/**
 *
 * @returns すべての作品
 */

export async function GET() {
	const ips = await getIps();
	return ips;
}

/**
 * IPを作成します。
 *
 * @returns 作成されたIP
 */
export async function POST({ request }: APIEvent) {
	const { name, description } = await request.json();
	const newIp = await createIp(name, description);
	return newIp;
}
