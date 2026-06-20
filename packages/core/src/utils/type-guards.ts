/**
 * Type guard to check if a value is a plain object (Record<string, unknown>).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a string.
 */
export function isString(value: unknown): value is string {
	return typeof value === "string";
}

/**
 * Type guard to check if a value is a number.
 */
export function isNumber(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

const BUFFER_ENCODINGS = ["ascii", "utf8", "utf-8", "utf16le", "ucs2", "ucs-2", "base64", "base64url", "latin1", "binary", "hex"] as const;
type BufferEncodingValue = (typeof BUFFER_ENCODINGS)[number];
export function isBufferEncoding(value: string): value is BufferEncodingValue {
	return (BUFFER_ENCODINGS as readonly string[]).includes(value);
}

/**
 * Type guard to check if an error has a stderr property (e.g., child process errors).
 */
export function hasStderr(error: unknown): error is Error & { stderr: string } {
	return error instanceof Error && "stderr" in error && typeof (error as Record<string, unknown>).stderr === "string";
}

// ---- Enum type guards for DB → Domain mapping ----

const MEDIA_STATUSES = ["active", "archived", "deleted"] as const;
const MEDIA_TYPES = ["image", "video", "audio"] as const;
const MEDIA_SOURCE_TYPES = ["local", "sftp", "s3"] as const;
const TAG_TYPES = ["positive", "negative"] as const;
const JOB_STATUSES = ["pending", "in_progress", "completed", "failed"] as const;

export function isMediaStatus(value: string): value is "active" | "archived" | "deleted" {
	return MEDIA_STATUSES.includes(value as (typeof MEDIA_STATUSES)[number]);
}

export function isMediaType(value: string): value is "image" | "video" | "audio" {
	return MEDIA_TYPES.includes(value as (typeof MEDIA_TYPES)[number]);
}

export function isMediaSourceType(value: string): value is "local" | "sftp" | "s3" {
	return MEDIA_SOURCE_TYPES.includes(value as (typeof MEDIA_SOURCE_TYPES)[number]);
}

export function isTagType(value: string): value is "positive" | "negative" {
	return TAG_TYPES.includes(value as (typeof TAG_TYPES)[number]);
}

export function isJobStatus(value: string): value is "pending" | "in_progress" | "completed" | "failed" {
	return JOB_STATUSES.includes(value as (typeof JOB_STATUSES)[number]);
}
