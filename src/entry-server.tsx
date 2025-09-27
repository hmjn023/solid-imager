// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

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
