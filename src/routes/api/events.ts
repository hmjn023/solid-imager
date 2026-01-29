import { type APIEvent, eventHandler } from "solid-start/api";
import { eventService } from "~/application/services/event-service";

export const GET = eventHandler(async (event: APIEvent) => {
  return eventService.createSseStream(event);
});
