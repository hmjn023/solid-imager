import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import sharp from "sharp";
import { defineConfig, type Plugin } from "vite";
import solidPlugin from "vite-plugin-solid";

const galleryRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(galleryRoot, "../../../../../..");

function createPhotoLikePixels(width: number, height: number): Buffer {
	const pixels = Buffer.alloc(width * height * 3);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = (y * width + x) * 3;
			const noise = ((x * 17 + y * 31 + ((x * y) % 97)) % 37) - 18;
			pixels[index] = Math.max(
				0,
				Math.min(255, 40 + (x * 150) / width + noise),
			);
			pixels[index + 1] = Math.max(
				0,
				Math.min(255, 80 + (y * 120) / height + noise),
			);
			pixels[index + 2] = Math.max(
				0,
				Math.min(255, 190 + (Math.sin(x / 11) + Math.cos(y / 9)) * 25 + noise),
			);
		}
	}
	return pixels;
}

const thumbnailBuffers = new Map(
	([256, 512] as const).map((width) => {
		const height = Math.round(width * 0.75);
		const pixels = createPhotoLikePixels(width, height);
		return [
			width,
			sharp(pixels, { raw: { channels: 3, height, width } })
				.webp({ effort: 4, quality: 82 })
				.toBuffer(),
		] as const;
	}),
);

function virtualThumbnailPlugin(): Plugin {
	return {
		name: "solid-imager-e2e-virtual-thumbnails",
		configureServer(server) {
			server.middlewares.use(async (request, response, next) => {
				const match = request.url?.match(
					/^\/virtual-thumbnail\/[0-9a-f-]+-(256|512)\.webp(?:\?.*)?$/,
				);
				if (!match) {
					next();
					return;
				}

				const width = Number(match[1]) as 256 | 512;
				const thumbnail = await thumbnailBuffers.get(width);
				if (!thumbnail) {
					response.statusCode = 404;
					response.end();
					return;
				}

				response.statusCode = 200;
				response.setHeader(
					"Cache-Control",
					"public, max-age=31536000, immutable",
				);
				response.setHeader("Content-Length", thumbnail.byteLength);
				response.setHeader("Content-Type", "image/webp");
				response.end(thumbnail);
			});
		},
	};
}

export default defineConfig({
	root: galleryRoot,
	resolve: {
		alias: {
			"@solid-imager/ui": path.join(workspaceRoot, "packages/ui/src"),
		},
		dedupe: ["solid-js", "solid-js/web"],
	},
	server: {
		fs: {
			allow: [workspaceRoot],
		},
	},
	plugins: [virtualThumbnailPlugin(), solidPlugin(), tailwindcss()],
});
