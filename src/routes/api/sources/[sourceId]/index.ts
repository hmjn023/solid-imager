import type { APIEvent } from "@solidjs/start/server";

export async function GET({params}: APIEvent) {
    return {
        endpoint: "/api/sources/[id]",
        params: params
    };
}
