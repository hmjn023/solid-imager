import type {APIEvent} from "@solidjs/start/server";

export async function GET({params}: APIEvent) {
    return {
        endpoint: "/api/sources/[sourceId]/[mediaId]",
        params: params
    };

}