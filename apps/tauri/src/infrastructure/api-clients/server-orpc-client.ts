import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/domain/contract";

const SERVER_URL = import.meta.env.VITE_API_URL || "http://192.168.1.150:3000";

export const serverOrpc = createClient<AppContract>({ url: SERVER_URL });
