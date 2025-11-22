/**
 * SSE Manager
 * Server-Sent Events management for real-time updates
 */

type SseClient = {
  controller: ReadableStreamDefaultController;
  id: string;
};

// mediaSourceId -> Set of clients
const clientsMap = new Map<string, Set<SseClient>>();

/**
 * Manages Server-Sent Events (SSE) for real-time updates to connected clients.
 */
export const SseManager = {
  /**
   * Adds a new client to the SSE manager for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source.
   * @param {ReadableStreamDefaultController} controller - The stream controller for the client.
   * @returns {string} The unique ID of the added client.
   */
  addClient(
    mediaSourceId: string,
    controller: ReadableStreamDefaultController
  ): string {
    const clientId = crypto.randomUUID();
    const client: SseClient = { controller, id: clientId };

    if (!clientsMap.has(mediaSourceId)) {
      clientsMap.set(mediaSourceId, new Set());
    }
    clientsMap.get(mediaSourceId)?.add(client);

    return clientId;
  },

  /**
   * Removes a client from the SSE manager.
   * @param {string} mediaSourceId - The ID of the media source.
   * @param {string} clientId - The ID of the client to remove.
   */
  removeClient(mediaSourceId: string, clientId: string): void {
    const clients = clientsMap.get(mediaSourceId);
    if (clients) {
      for (const client of clients) {
        if (client.id === clientId) {
          clients.delete(client);
          break;
        }
      }
      if (clients.size === 0) {
        clientsMap.delete(mediaSourceId);
      }
    }
  },

  /**
   * Sends an SSE event to connected clients for a specific media source.
   * @param {string} mediaSourceId - The ID of the media source related to the event.
   * @param {string} eventType - The type of the event (e.g., "thumbnail_progress", "file_added").
   * @param {unknown} data - The data payload of the event.
   */
  sendEvent(mediaSourceId: string, eventType: string, data: unknown): void {
    const clients = clientsMap.get(mediaSourceId);
    if (!clients) {
      return;
    }

    const payload = JSON.stringify(data);
    const message = `event: ${eventType}\ndata: ${payload}\n\n`;
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(message);

    for (const client of clients) {
      try {
        client.controller.enqueue(encodedMessage);
      } catch (_error) {
        this.removeClient(mediaSourceId, client.id);
      }
    }
  },

  /**
   * Starts file system monitoring for a specific media source to generate SSE events.
   * This typically uses `chokidar` for local file system changes.
   * @param {string} _mediaSourceId - The ID of the media source to monitor.
   * @param {string} _path - The file system path to monitor.
   */
  monitorFileSystem(_mediaSourceId: string, _path: string): void {
    // TODO: Start chokidar filesystem monitoring
    // This will be implemented in a future task if needed
  },
};
