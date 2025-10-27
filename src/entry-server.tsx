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
        {/** biome-ignore lint/style/noHeadElement: SolidStart requires this for server-side rendering. */}
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
