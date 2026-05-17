import { defineNitroConfig } from "nitro/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineNitroConfig({
  externals: {
    external: ["@electric-sql/pglite"],
  },
  hooks: {
    compiled: (nitro) => {
      const serverDir = nitro.options.output.serverDir;
      const libsDir = path.join(serverDir, "_libs");
      
      // Resolve the source directory of pglite assets from node_modules
      const pglitePkgPath = path.dirname(path.resolve(__dirname, "node_modules/@electric-sql/pglite/package.json"));
      const pgliteDistPath = path.join(pglitePkgPath, "dist");
      
      const assetsToCopy = ["pglite.data", "pglite.wasm"];

      for (const asset of assetsToCopy) {
        const source = path.join(pgliteDistPath, asset);
        const destination = path.join(libsDir, asset);

        if (fs.existsSync(source)) {
          if (!fs.existsSync(libsDir)) {
            fs.mkdirSync(libsDir, { recursive: true });
          }
          fs.copyFileSync(source, destination);
          console.log(`[Nitro] Successfully copied ${asset} to ${destination}`);
        } else {
          console.warn(`[Nitro] Warning: ${asset} not found at ${source}`);
        }
      }
    },
  },
});
