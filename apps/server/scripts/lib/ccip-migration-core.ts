import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
	access,
	mkdir,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { CcipVectorRecord } from "@solid-imager/application/ports/ccip-vector-store";
import { z } from "zod";

export const CCIP_MIGRATION_TOOL_VERSION = "ccip-pgvector-migration-v1";
export const CCIP_VECTOR_DIMENSIONS = 768;

const uuidSchema = z.string().uuid();
const dateSchema = z.coerce.date().refine((value) => !Number.isNaN(value.getTime()));
const vectorRecordSchema = z.object({
	regionId: z.string().uuid().nullable(),
	regionKind: z.enum(["full", "person", "manual"]),
	mediaId: z.string().uuid(),
	mediaSourceId: z.string().uuid(),
	vector: z.array(z.number().finite()).length(CCIP_VECTOR_DIMENSIONS),
	model: z.string().min(1),
	embeddingVersion: z.number().int().nonnegative(),
	mediaModifiedAt: dateSchema,
	inputRevision: z.string().min(1),
	preprocessingProfile: z.string().min(1),
	extractedAt: dateSchema,
});

export type DirectoryManifestEntry = {
	path: string;
	bytes: number;
	sha256: string;
};

export type DirectoryManifest = {
	root: string;
	entries: DirectoryManifestEntry[];
	totalBytes: number;
	fingerprint: string;
};

export type MigrationIssueCode =
	| "SOURCE_READ_FAILED"
	| "SOURCE_CHANGED"
	| "INVALID_RECORD"
	| "ZERO_NORM_VECTOR"
	| "CONFLICTING_DUPLICATE"
	| "SOURCE_ORDER_CHANGED"
	| "ORPHAN_MEDIA"
	| "MEDIA_SOURCE_MISMATCH"
	| "CANONICAL_RECORD_MISSING"
	| "CHECKPOINT_MISMATCH"
	| "PARITY_MISMATCH"
	| "RUST_RERANK_SKIPPED"
	| "RUST_RERANK_FAILED";

export type MigrationIssue = {
	code: MigrationIssueCode;
	message: string;
	logicalKey?: string;
	mediaId?: string;
};

export type ScanSummary = {
	rawRows: number;
	uniqueLogicalRows: number;
	collapsedDuplicates: number;
	issues: MigrationIssue[];
};

export type CheckpointIdentity = {
	sourceFingerprint: string;
	codeFingerprint: string;
	schemaFingerprint: string;
	optionsFingerprint: string;
};

export type MigrationCheckpoint = CheckpointIdentity & {
	version: 1;
	toolVersion: typeof CCIP_MIGRATION_TOOL_VERSION;
	lastCompletedKey: string | null;
	completedRecords: number;
	updatedAt: string;
};

const checkpointSchema = z.object({
	version: z.literal(1),
	toolVersion: z.literal(CCIP_MIGRATION_TOOL_VERSION),
	sourceFingerprint: z.string().length(64),
	codeFingerprint: z.string().length(64),
	schemaFingerprint: z.string().length(64),
	optionsFingerprint: z.string().length(64),
	lastCompletedKey: z.string().nullable(),
	completedRecords: z.number().int().nonnegative(),
	updatedAt: z.string().datetime(),
});

export type ExistingMedia = {
	id: string;
	mediaSourceId: string;
};

export function stableJson(value: unknown): string {
	return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortJson);
	}
	if (typeof value === "object" && value !== null) {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, item]) => [key, sortJson(item)]),
		);
	}
	return value;
}

export function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

async function hashFile(filePath: string): Promise<string> {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(filePath)) {
		hash.update(chunk);
	}
	return hash.digest("hex");
}

async function listFiles(root: string, relative = ""): Promise<string[]> {
	const directory = path.join(root, relative);
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
		const child = relative ? path.posix.join(relative, entry.name) : entry.name;
		if (entry.isSymbolicLink()) {
			throw new Error(`Symbolic links are not allowed in a CCIP snapshot: ${child}`);
		}
		if (entry.isDirectory()) {
			files.push(...(await listFiles(root, child)));
		} else if (entry.isFile()) {
			files.push(child);
		} else {
			throw new Error(`Unsupported file type in a CCIP snapshot: ${child}`);
		}
	}
	return files;
}

export async function createDirectoryManifest(
	directory: string,
): Promise<DirectoryManifest> {
	const root = await realpath(directory);
	const rootStat = await stat(root);
	if (!rootStat.isDirectory()) {
		throw new Error(`CCIP source is not a directory: ${root}`);
	}
	const entries: DirectoryManifestEntry[] = [];
	for (const relativePath of await listFiles(root)) {
		const absolutePath = path.join(root, relativePath);
		const before = await stat(absolutePath);
		const fileHash = await hashFile(absolutePath);
		const after = await stat(absolutePath);
		if (
			before.size !== after.size ||
			before.mtimeMs !== after.mtimeMs ||
			before.ino !== after.ino
		) {
			throw new Error(`CCIP source changed while hashing: ${relativePath}`);
		}
		entries.push({ path: relativePath, bytes: after.size, sha256: fileHash });
	}
	const totalBytes = entries.reduce((total, entry) => total + entry.bytes, 0);
	return {
		root,
		entries,
		totalBytes,
		fingerprint: sha256(stableJson(entries)),
	};
}

export function manifestsMatch(
	left: DirectoryManifest,
	right: DirectoryManifest,
): boolean {
	return left.fingerprint === right.fingerprint && stableJson(left.entries) === stableJson(right.entries);
}

export async function filesFingerprint(files: string[]): Promise<string> {
	const entries: Array<{ path: string; bytes: number; sha256: string }> = [];
	for (const file of [...files].sort()) {
		const absolutePath = path.resolve(file);
		const fileStat = await stat(absolutePath);
		entries.push({
			path: absolutePath,
			bytes: fileStat.size,
			sha256: await hashFile(absolutePath),
		});
	}
	return sha256(stableJson(entries));
}

export function sourceLogicalKey(record: CcipVectorRecord): string {
	return stableJson([
		record.mediaId,
		record.model,
		record.embeddingVersion,
		record.preprocessingProfile,
	]);
}

export function canonicalLogicalKey(record: CcipVectorRecord): string {
	if (!record.regionId) {
		throw new Error(`Canonical CCIP record is missing regionId: ${record.mediaId}`);
	}
	return stableJson([
		record.regionId,
		record.model,
		record.embeddingVersion,
		record.preprocessingProfile,
	]);
}

export function validateRecord(value: unknown): {
	record?: CcipVectorRecord;
	issues: MigrationIssue[];
} {
	const parsed = vectorRecordSchema.safeParse(value);
	if (!parsed.success) {
		return {
			issues: [
				{
					code: "INVALID_RECORD",
					message: z.prettifyError(parsed.error),
					mediaId: readStringField(value, "mediaId"),
				},
			],
		};
	}
	const squaredNorm = parsed.data.vector.reduce(
		(total, component) => total + component * component,
		0,
	);
	if (!Number.isFinite(squaredNorm) || squaredNorm === 0) {
		return {
			issues: [
				{
					code: "ZERO_NORM_VECTOR",
					message: `CCIP vector has zero or non-finite norm: ${parsed.data.mediaId}`,
					mediaId: parsed.data.mediaId,
				},
			],
		};
	}
	return { record: parsed.data, issues: [] };
}

function readStringField(value: unknown, field: string): string | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	const fieldValue = Reflect.get(value, field);
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

function duplicatePayload(record: CcipVectorRecord): string {
	return stableJson({
		regionId: record.regionId,
		regionKind: record.regionKind,
		mediaId: record.mediaId,
		mediaSourceId: record.mediaSourceId,
		vector: record.vector,
		model: record.model,
		embeddingVersion: record.embeddingVersion,
		mediaModifiedAt: record.mediaModifiedAt.toISOString(),
		inputRevision: record.inputRevision,
		preprocessingProfile: record.preprocessingProfile,
	});
}

export async function scanCollapsedRecords(
	batches: AsyncIterable<unknown[]>,
	onRecord?: (record: CcipVectorRecord, logicalKey: string) => Promise<void>,
): Promise<ScanSummary> {
	const summary: ScanSummary = {
		rawRows: 0,
		uniqueLogicalRows: 0,
		collapsedDuplicates: 0,
		issues: [],
	};
	let current:
		| { key: string; record: CcipVectorRecord; payload: string; conflict: boolean }
		| undefined;
	let previousCompletedKey: string | undefined;

	const flush = async () => {
		if (!current) return;
		summary.uniqueLogicalRows += 1;
		if (!current.conflict && onRecord) {
			await onRecord(current.record, current.key);
		}
		previousCompletedKey = current.key;
		current = undefined;
	};

	try {
		for await (const batch of batches) {
			for (const value of batch) {
				summary.rawRows += 1;
				const validation = validateRecord(value);
				if (!validation.record) {
					summary.issues.push(...validation.issues);
					continue;
				}
				const record = validation.record;
				const key = sourceLogicalKey(record);
				const payload = duplicatePayload(record);
				if (!current || current.key !== key) {
					await flush();
					if (previousCompletedKey && key.localeCompare(previousCompletedKey) < 0) {
						summary.issues.push({
							code: "SOURCE_ORDER_CHANGED",
							message: `Legacy CCIP rows are not ordered deterministically: ${key}`,
							logicalKey: key,
							mediaId: record.mediaId,
						});
					}
					current = { key, record, payload, conflict: false };
					continue;
				}
				if (current.payload !== payload) {
					if (!current.conflict) {
						summary.issues.push({
							code: "CONFLICTING_DUPLICATE",
							message: `Conflicting legacy CCIP records: ${key}`,
							logicalKey: key,
							mediaId: record.mediaId,
						});
					}
					current.conflict = true;
					continue;
				}
				summary.collapsedDuplicates += 1;
				if (record.extractedAt.getTime() > current.record.extractedAt.getTime()) {
					current.record = record;
				}
			}
		}
		await flush();
	} catch (error) {
		summary.issues.push({
			code: "SOURCE_READ_FAILED",
			message: error instanceof Error ? error.message : String(error),
		});
	}
	return summary;
}

export function validateMediaReferences(
	records: CcipVectorRecord[],
	existingMedia: ReadonlyMap<string, ExistingMedia>,
): MigrationIssue[] {
	const issues: MigrationIssue[] = [];
	for (const record of records) {
		const media = existingMedia.get(record.mediaId);
		if (!media) {
			issues.push({
				code: "ORPHAN_MEDIA",
				message: `Legacy CCIP record references missing media: ${record.mediaId}`,
				logicalKey: sourceLogicalKey(record),
				mediaId: record.mediaId,
			});
		} else if (media.mediaSourceId !== record.mediaSourceId) {
			issues.push({
				code: "MEDIA_SOURCE_MISMATCH",
				message: `Legacy CCIP media source mismatch: ${record.mediaId}`,
				logicalKey: sourceLogicalKey(record),
				mediaId: record.mediaId,
			});
		}
	}
	return issues;
}

export function createOptionsFingerprint(options: Record<string, unknown>): string {
	return sha256(stableJson(options));
}

export function createCheckpoint(
	identity: CheckpointIdentity,
	lastCompletedKey: string | null,
	completedRecords: number,
): MigrationCheckpoint {
	return {
		version: 1,
		toolVersion: CCIP_MIGRATION_TOOL_VERSION,
		...identity,
		lastCompletedKey,
		completedRecords,
		updatedAt: new Date().toISOString(),
	};
}

export async function readCheckpoint(filePath: string): Promise<MigrationCheckpoint> {
	return checkpointSchema.parse(JSON.parse(await readFile(filePath, "utf8")));
}

export function assertCheckpointCompatible(
	checkpoint: MigrationCheckpoint,
	identity: CheckpointIdentity,
): void {
	for (const field of [
		"sourceFingerprint",
		"codeFingerprint",
		"schemaFingerprint",
		"optionsFingerprint",
	] as const) {
		if (checkpoint[field] !== identity[field]) {
			throw new Error(`Checkpoint ${field} does not match this migration run`);
		}
	}
}

export async function assertPathAbsent(filePath: string): Promise<void> {
	try {
		await access(filePath);
		throw new Error(`Refusing to overwrite existing file: ${filePath}`);
	} catch (error) {
		if (isNodeError(error) && error.code === "ENOENT") return;
		throw error;
	}
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error;
}

export async function writeJsonNoOverwrite(
	filePath: string,
	value: unknown,
): Promise<void> {
	const absolutePath = path.resolve(filePath);
	const partialPath = `${absolutePath}.partial`;
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await assertPathAbsent(absolutePath);
	await assertPathAbsent(partialPath);
	try {
		await writeFile(partialPath, `${JSON.stringify(value, null, 2)}\n`, {
			flag: "wx",
		});
		await rename(partialPath, absolutePath);
	} catch (error) {
		await rm(partialPath, { force: true });
		throw error;
	}
}

export async function writeCheckpointAtomic(
	filePath: string,
	checkpoint: MigrationCheckpoint,
	allowReplace: boolean,
): Promise<void> {
	const absolutePath = path.resolve(filePath);
	const partialPath = `${absolutePath}.partial`;
	await mkdir(path.dirname(absolutePath), { recursive: true });
	if (!allowReplace) await assertPathAbsent(absolutePath);
	await assertPathAbsent(partialPath);
	try {
		await writeFile(partialPath, `${JSON.stringify(checkpoint, null, 2)}\n`, {
			flag: "wx",
		});
		await rename(partialPath, absolutePath);
	} catch (error) {
		await rm(partialPath, { force: true });
		throw error;
	}
}

export function parseUuid(value: string, option: string): string {
	const result = uuidSchema.safeParse(value);
	if (!result.success) throw new Error(`${option} requires a UUID`);
	return result.data;
}
