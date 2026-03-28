import { defineNitroConfig } from "nitropack/config";

export default defineNitroConfig({
  externals: {
    external: ["@electric-sql/pglite"],
  },
});
