// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

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
        <body>
          {assets}
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
