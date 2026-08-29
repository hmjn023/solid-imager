import path from "node:path";

const inputPath =
	process.argv[2] ??
	path.resolve(process.cwd(), "src/tests/fixtures/test-image-with-metadata.png");

const source = Bun.file(inputPath).image();
const metadata = await source.metadata();

if (!(metadata.width && metadata.height)) {
	throw new Error(`Bun.Image could not read dimensions from ${inputPath}`);
}

const resized = await Bun.file(inputPath)
	.image()
	.resize(64, 64, { fit: "inside", withoutEnlargement: true })
	.webp({ quality: 80 })
	.bytes();
const resizedMetadata = await new Bun.Image(resized).metadata();

if (
	resizedMetadata.format !== "webp" ||
	!(resizedMetadata.width && resizedMetadata.height) ||
	resizedMetadata.width > 64 ||
	resizedMetadata.height > 64
) {
	throw new Error("Bun.Image resize/WebP conversion produced invalid output");
}

process.stdout.write(
	`Bun.Image OK: ${metadata.width}x${metadata.height} -> ${resizedMetadata.width}x${resizedMetadata.height} WebP\n`,
);
