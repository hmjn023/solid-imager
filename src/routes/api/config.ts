import { getConfig, resetConfig, updateConfig } from "~/lib/api/config";

export async function GET() {
	const config = await getConfig();
	return config;
}

/**
 * 設定を更新します。
 *
 * @returns 更新された設定
 */
export async function PUT({ request }: APIEvent) {
	const newConfig = await request.json();
	const updatedConfig = await updateConfig(newConfig);
	return updatedConfig;
}

/**
 * 設定をデフォルトにリセットします。
 *
 * @returns リセットされた設定
 */
export async function POST() {
	const result = await resetConfig();
	return result;
}
