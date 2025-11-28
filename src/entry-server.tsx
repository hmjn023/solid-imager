// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

// Initialize file system monitoring on server startup
if (typeof window === "undefined") {
  // Server-side only
  import("~/infrastructure/jobs/file-watcher-service")
    .then((module) => {
      module.FileWatcherService.startMonitoringAll().catch((_error) => {
        // Error already logged in startMonitoringAll
      });
    })
    .catch((_error) => {
      // Error already logged in then block
    });
}

/**
 * Creates and exports the SolidStart server handler.
 * This function defines the server-side rendering structure of the application,
 * including the HTML document layout.
 * @returns {Function} The SolidStart server handler.
 */
export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        {/* biome-ignore lint/style/noHeadElement: SolidStart uses <head> */}
        <head>
          <meta charset="utf-8" />
          <meta content="width=device-width, initial-scale=1" name="viewport" />
          <link href="/favicon.ico" rel="icon" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
