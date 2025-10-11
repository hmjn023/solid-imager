import type { APIEvent } from "@solidjs/start/server";
import { getConfig, resetConfig, updateConfig } from "~/lib/api/config";
import type { AppConfig } from "~/lib/types";

export function GET() {
  try {
    const config = getConfig();
    return config;
  } catch (error: any) {
    return {
      error: error.message,
      status: 500,
    };
  }
}

export async function PUT({ request }: APIEvent) {
  try {
    const newConfig = (await request.json()) as AppConfig;
    const result = updateConfig(newConfig);
    return result;
  } catch (error: any) {
    return {
      error: error.message,
      status: 400,
    };
  }
}

export function POST() {
  try {
    const result = resetConfig();
    return result;
  } catch (error: any) {
    return { error: error.message, status: 500 };
  }
}
