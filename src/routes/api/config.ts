import { type APIEvent, json } from "solid-start/api";
import {
  getConfig,
  resetConfig,
  updateConfig,
} from "~/lib/api/config";
import type { AppConfig } from "~/lib/types";

export async function GET() {
  try {
    const config = getConfig();
    return json(config);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function PUT({ request }: APIEvent) {
  try {
    const newConfig = (await request.json()) as AppConfig;
    const result = updateConfig(newConfig);
    return json(result);
  } catch (error: any) {
    return json({ error: error.message }, { status: 400 });
  }
}

export async function POST() {
  try {
    const result = resetConfig();
    return json(result);
  } catch (error: any) {
    return json({ error: error.message }, { status: 500 });
  }
}