import type { APIEvent } from "@solidjs/start/server";
import { eventService } from "~/application/services/event-service";

export function GET(event: APIEvent) {
	return eventService.createSseStream(event);
}
