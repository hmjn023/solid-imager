import { defineNitroConfig } from "nitro/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineNitroConfig({
  preset: "bun",
  rollupConfig: {
    external: ["@lancedb/lancedb", "apache-arrow", /^@lancedb\/lancedb-/, "dghs-imgutils-rs"],
  },
  hooks: {
    compiled: (nitro) => {
      const serverDir = nitro.options.output.serverDir;
      const libsDir = path.join(serverDir, "_libs");

      // Resolve the source directory of pglite assets from node_modules
      const pgliteLocalPath = path.resolve(
        __dirname,
        "node_modules/@electric-sql/pglite/package.json",
      );
      const pgliteRootPath = path.resolve(
        __dirname,
        "../../node_modules/@electric-sql/pglite/package.json",
      );
      const pglitePkgPath = path.dirname(
        fs.existsSync(pgliteLocalPath) ? pgliteLocalPath : pgliteRootPath,
      );
      const pgliteDistPath = path.join(pglitePkgPath, "dist");
	  const pgvectorLocalPath = path.resolve(
		__dirname,
		"node_modules/@electric-sql/pglite-pgvector/package.json",
	  );
	  const pgvectorRootPath = path.resolve(
		__dirname,
		"../../node_modules/@electric-sql/pglite-pgvector/package.json",
	  );
	  const pgvectorPkgPath = path.dirname(
		fs.existsSync(pgvectorLocalPath) ? pgvectorLocalPath : pgvectorRootPath,
	  );

	  const assetsToCopy = [
		{
		  source: path.join(pgliteDistPath, "pglite.data"),
		  destination: path.join(libsDir, "pglite.data"),
		},
		{
		  source: path.join(pgliteDistPath, "pglite.wasm"),
		  destination: path.join(libsDir, "pglite.wasm"),
		},
		{
		  source: path.join(pgvectorPkgPath, "dist", "vector.tar.gz"),
		  destination: path.join(libsDir, "vector.tar.gz"),
		},
	  ];

	  fs.mkdirSync(libsDir, { recursive: true });
	  for (const asset of assetsToCopy) {
		if (!fs.existsSync(asset.source) || fs.statSync(asset.source).size === 0) {
		  throw new Error(
			`Required PGlite runtime asset is missing or empty: ${asset.source}`,
		  );
		}
		fs.copyFileSync(asset.source, asset.destination);
		console.log(
		  `[Nitro] Successfully copied ${path.basename(asset.source)} to ${asset.destination}`,
		);
      }

	  const migrationsSource = path.join(__dirname, "drizzle");
	  const migrationsDestination = path.join(serverDir, "drizzle");
	  const journalSource = path.join(migrationsSource, "meta", "_journal.json");
	  if (!fs.existsSync(journalSource) || fs.statSync(journalSource).size === 0) {
		throw new Error(`Drizzle migration journal is missing or empty: ${journalSource}`);
	  }
	  fs.cpSync(migrationsSource, migrationsDestination, { recursive: true });

      // Copy yt-dlp binary for bundled youtube-dl-exec
      const ytDlpLocalPath = path.resolve(__dirname, "node_modules/youtube-dl-exec/bin/yt-dlp");
      const ytDlpRootPath = path.resolve(
        __dirname,
        "../../node_modules/youtube-dl-exec/bin/yt-dlp",
      );
      const ytDlpSource = fs.existsSync(ytDlpLocalPath) ? ytDlpLocalPath : ytDlpRootPath;
      const binDir = path.join(serverDir, "bin");
      const ytDlpDest = path.join(binDir, "yt-dlp");
      if (fs.existsSync(ytDlpSource)) {
        if (!fs.existsSync(binDir)) {
          fs.mkdirSync(binDir, { recursive: true });
        }
        fs.copyFileSync(ytDlpSource, ytDlpDest);
        fs.chmodSync(ytDlpDest, 0o755);
        console.log(`[Nitro] Successfully copied yt-dlp to ${ytDlpDest}`);
      } else {
        console.warn(`[Nitro] Warning: yt-dlp binary not found at ${ytDlpSource}`);
      }

      // Copy ffmpeg binary for bundled ffmpeg-static
      const ffmpegLocalPath = path.resolve(__dirname, "node_modules/ffmpeg-static/ffmpeg");
      const ffmpegRootPath = path.resolve(__dirname, "../../node_modules/ffmpeg-static/ffmpeg");
      const ffmpegSource = fs.existsSync(ffmpegLocalPath) ? ffmpegLocalPath : ffmpegRootPath;
      const ffmpegDest = path.join(libsDir, "ffmpeg");
      if (fs.existsSync(ffmpegSource)) {
        fs.copyFileSync(ffmpegSource, ffmpegDest);
        fs.chmodSync(ffmpegDest, 0o755);
        console.log(`[Nitro] Successfully copied ffmpeg to ${ffmpegDest}`);
      } else {
        console.warn(`[Nitro] Warning: ffmpeg binary not found at ${ffmpegSource}`);
      }
    },
  },
});
