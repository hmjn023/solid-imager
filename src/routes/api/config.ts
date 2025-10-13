import type { APIEvent } from "@solidjs/start/server";
import type { AppConfig } from "~/domain/shared/types";
import {
  getConfig,
  resetConfig,
  updateConfig,
} from "~/infrastructure/api-clients/config";

export function GET() {
  try {
    const config = getConfig();
    return config;
  } catch (error: unknown) {
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
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    return { error: error.message, status: 500 };
  }
}
