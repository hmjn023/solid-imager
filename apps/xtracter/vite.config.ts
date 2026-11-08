import path from "node:path";
import { build, defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

const extensionRoot = import.meta.dirname;
const resolve = {
  alias: {
    "@ext": path.resolve(extensionRoot, "src"),
  },
};

function standaloneContentScripts(mode: string): Plugin {
  return {
    name: "xtracter-standalone-content-scripts",
    apply: "build",
    async closeBundle() {
      // Manifest content scripts are classic scripts and cannot load shared ESM chunks.
      for (const [name, entry, globalName] of [
        ["content", "src/content/index.ts", "XtracterContent"],
        ["twitter-network", "src/content/twitter-network.ts", "XtracterTwitterNetwork"],
      ]) {
        await build({
          configFile: false,
          root: extensionRoot,
          mode,
          publicDir: false,
          resolve,
          build: {
            outDir: "dist",
            emptyOutDir: false,
            lib: {
              entry: path.resolve(extensionRoot, entry),
              name: globalName,
              formats: ["iife"],
              fileName: () => `${name}.js`,
            },
          },
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [solidPlugin(), standaloneContentScripts(mode)],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        popup: path.resolve(extensionRoot, "src/popup/index.html"),
        background: path.resolve(extensionRoot, "src/background/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
  resolve,
}));
