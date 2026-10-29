import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { graphManifestSchema, mediaRecordSchema } from "./schemas";

const MAGIC = Buffer.from([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59]);

/** Read only numeric, C-order little-endian NPY arrays. Never evaluate a header. */
export function decodeNpy(bytes: Buffer) {
	if (
		!bytes.subarray(0, 6).equals(MAGIC) ||
		bytes.length < 10 ||
		bytes[7] !== 0 ||
		![1, 2].includes(bytes[6])
	)
		throw new Error("Unsupported NPY header");
	const prefix = bytes[6] === 1 ? 10 : 12;
	if (bytes.length < prefix) throw new Error("Truncated NPY header");
	const size = prefix === 10 ? bytes.readUInt16LE(8) : bytes.readUInt32LE(8);
	const header = bytes.subarray(prefix, prefix + size).toString("ascii");
	const dtype = /['"]descr['"]\s*:\s*['"](<i4|<f8)['"]/.exec(header)?.[1];
	const shapeText = /['"]shape['"]\s*:\s*\((\s*\d+\s*,\s*\d+\s*,?\s*)\)/.exec(
		header,
	)?.[1];
	if (
		!dtype ||
		!shapeText ||
		!/['"]fortran_order['"]\s*:\s*False/.test(header) ||
		prefix + size > bytes.length
	)
		throw new Error("Expected a numeric 2D C-order NPY array");
	const shape = shapeText
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.map(Number);
	const count = shape[0] * shape[1];
	const width = dtype === "<i4" ? 4 : 8;
	if (
		shape.length !== 2 ||
		!shape.every((value) => Number.isSafeInteger(value) && value > 0) ||
		!Number.isSafeInteger(count) ||
		bytes.length !== prefix + size + count * width
	)
		throw new Error("Invalid NPY dimensions or payload length");
	if (new Uint8Array(Uint32Array.of(1).buffer)[0] !== 1)
		throw new Error("Little-endian runtime required");
	const data = bytes.buffer.slice(
		bytes.byteOffset + prefix + size,
		bytes.byteOffset + bytes.length,
	);
	return {
		rows: shape[0],
		columns: shape[1],
		values: dtype === "<i4" ? new Int32Array(data) : new Float64Array(data),
	};
}

export function encodeNpy(
	values: Int32Array | Float64Array,
	rows: number,
	columns: number,
): Buffer {
	if (
		!Number.isSafeInteger(rows) ||
		rows < 1 ||
		!Number.isSafeInteger(columns) ||
		columns < 1 ||
		values.length !== rows * columns
	)
		throw new Error("Invalid NPY dimensions");
	const dtype = values instanceof Int32Array ? "<i4" : "<f8";
	const literal = `{'descr': '${dtype}', 'fortran_order': False, 'shape': (${rows}, ${columns}), }`;
	const header =
		literal + " ".repeat((64 - ((10 + literal.length + 1) % 64)) % 64) + "\n";
	const prefix = Buffer.alloc(10);
	MAGIC.copy(prefix);
	prefix[6] = 1;
	prefix[7] = 0;
	prefix.writeUInt16LE(header.length, 8);
	return Buffer.concat([
		prefix,
		Buffer.from(header),
		Buffer.from(values.buffer, values.byteOffset, values.byteLength),
	]);
}

export function checksum(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

export async function writeJson(
	filename: string,
	value: object,
): Promise<void> {
	const temporary = `${filename}.tmp`;
	await writeFile(temporary, JSON.stringify(value, null, 2) + "\n");
	await rename(temporary, filename);
}

export async function loadSnapshot(directory: string) {
	const manifest = graphManifestSchema.parse(
		JSON.parse(await readFile(path.join(directory, "graph.json"), "utf8")),
	);
	if (manifest.status !== "complete")
		throw new Error("Graph snapshot is not complete");
	const names = ["media.jsonl", "indices.npy", "distances.npy"] as const;
	const [media, indicesFile, distancesFile] = await Promise.all(
		names.map(async (name) => {
			const bytes = await readFile(path.join(directory, name));
			if (checksum(bytes) !== manifest.checksums[name])
				throw new Error(`Snapshot checksum mismatch: ${name}`);
			return bytes;
		}),
	);
	const records = media
		.toString("utf8")
		.trim()
		.split("\n")
		.map((line) => mediaRecordSchema.parse(JSON.parse(line)));
	const indices = decodeNpy(indicesFile);
	const distances = decodeNpy(distancesFile);
	if (
		!(indices.values instanceof Int32Array) ||
		!(distances.values instanceof Float64Array) ||
		records.length !== manifest.points ||
		indices.rows !== manifest.points ||
		distances.rows !== manifest.points ||
		indices.columns !== manifest.neighbors ||
		distances.columns !== manifest.neighbors
	)
		throw new Error("Snapshot dimensions or dtypes do not match");
	if (
		new Set(records.map((record) => record.embedding_id)).size !==
			records.length ||
		new Set(records.map((record) => record.media_id)).size !== records.length
	)
		throw new Error("Duplicate snapshot media or embedding IDs");
	return {
		manifest,
		records,
		indices: indices.values,
		distances: distances.values,
	};
}
