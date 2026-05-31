import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";

const isDev = import.meta.env.DEV;
const API_URL = isDev
	? window.location.origin // Vite proxy forwards /api to target
	: import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";

export const client = createClient<AppContract>({ url: API_URL });
export const orpc = client;
