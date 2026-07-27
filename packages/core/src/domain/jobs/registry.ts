import type { NewJob } from "../repositories/job-repository";
import { jobEnvelopeSchema, type JobQueueName, type JobType } from "./schemas";

export const DEFAULT_JOB_LEASE_MS = 5 * 60 * 1000;
export const JOB_HEARTBEAT_MS = 30 * 1000;

export type JobPolicy = {
  queueName: JobQueueName;
  maxAttempts: number;
  leaseDurationMs: number;
};

const DEFAULT_POLICY: JobPolicy = {
  queueName: "default",
  maxAttempts: 5,
  leaseDurationMs: DEFAULT_JOB_LEASE_MS,
};

const AI_POLICY: JobPolicy = {
  queueName: "ai",
  maxAttempts: 5,
  leaseDurationMs: DEFAULT_JOB_LEASE_MS,
};

const DISPATCH_POLICY: JobPolicy = {
  queueName: "default",
  maxAttempts: 3,
  leaseDurationMs: DEFAULT_JOB_LEASE_MS,
};

export const JOB_POLICIES: Record<JobType, JobPolicy> = {
  processMedia: DEFAULT_POLICY,
  downloadImage: DEFAULT_POLICY,
  auto_tagging: AI_POLICY,
  extract_ccip_vector: AI_POLICY,
  bulk_tagging_parent: DISPATCH_POLICY,
  bulk_tagging_dispatch: DISPATCH_POLICY,
  batch_ccip_parent: DISPATCH_POLICY,
  batch_ccip_dispatch: DISPATCH_POLICY,
  import_request: DEFAULT_POLICY,
  sync_lancedb: DEFAULT_POLICY,
  sync_lancedb_full: DEFAULT_POLICY,
  sync_lancedb_delta: DEFAULT_POLICY,
};

export type PreparedJob = NewJob & {
  type: JobType;
  queueName: JobQueueName;
  maxAttempts: number;
  leaseDurationMs: number;
};

export function isKnownJobType(type: string): type is JobType {
  return Object.hasOwn(JOB_POLICIES, type);
}

export function validateJobPayload(type: string, payload: unknown) {
  return jobEnvelopeSchema.safeParse({ type, payload });
}

/** Adds deterministic queue, retry and fencing metadata at the repository edge. */
export function prepareJob(job: NewJob): PreparedJob {
  if (!isKnownJobType(job.type)) {
    throw new Error(`Unknown job type: ${job.type}`);
  }
  const policy = JOB_POLICIES[job.type];
  const targetId = job.targetId ?? inferTargetId(job);
  const inputRevision = job.inputRevision ?? inferInputRevision(job);
  const force = getBoolean(job.payload, "force") ? "force" : "normal";
  const dedupeKey = job.dedupeKey ?? buildDedupeKey(job.type, targetId, inputRevision, force, job);
  const concurrencyKey = job.concurrencyKey ?? buildConcurrencyKey(job.type, targetId, job);

  return {
    ...job,
    type: job.type,
    queueName: job.queueName ?? policy.queueName,
    targetId,
    inputRevision,
    dedupeKey,
    concurrencyKey,
    availableAt: job.availableAt ?? new Date(),
    attemptCount: job.attemptCount ?? 0,
    maxAttempts: job.maxAttempts ?? policy.maxAttempts,
    leaseDurationMs: job.leaseDurationMs ?? policy.leaseDurationMs,
  };
}

export function retryDelayMs(attemptCount: number, random = Math.random()): number {
  const exponent = Math.max(0, attemptCount - 1);
  const base = Math.min(15 * 60 * 1000, 5_000 * 2 ** exponent);
  return Math.min(15 * 60 * 1000, Math.round(base * (0.8 + random * 0.4)));
}

function inferTargetId(job: NewJob): string | null {
  const mediaId = getString(job.payload, "mediaId");
  if (mediaId) return mediaId;
  if (job.parentId) return job.parentId;
  return job.mediaSourceId ?? null;
}

function inferInputRevision(job: NewJob): string | null {
  return (
    getString(job.payload, "inputRevision") ?? getString(job.payload, "sourceRevision") ?? null
  );
}

function buildDedupeKey(
  type: JobType,
  targetId: string | null,
  inputRevision: string | null,
  force: string,
  job: NewJob,
): string | null {
  if (type === "import_request") {
    // Import requests are an inbox: identical URLs may represent separate user
    // actions and do not have a destination until they are accepted.
    return null;
  }
  if (type === "downloadImage") {
    const url = getString(job.payload, "targetUrl") ?? getString(job.payload, "imageUrl");
    const destination =
      getString(job.payload, "filePath") ?? getString(job.payload, "fileName") ?? "auto";
    return url && job.mediaSourceId
      ? `${type}:${job.mediaSourceId}:${destination}:${url}`
      : null;
  }
  if (type === "sync_lancedb" || type === "sync_lancedb_full") {
    return job.mediaSourceId ? `sync_lancedb_full:${job.mediaSourceId}` : null;
  }
  if (type === "sync_lancedb_delta") {
    return job.mediaSourceId ? `sync_lancedb_delta:${job.mediaSourceId}` : null;
  }
  if (type === "bulk_tagging_dispatch" || type === "batch_ccip_dispatch") {
    return job.parentId ? `${type}:${job.parentId}` : null;
  }
  if (type === "bulk_tagging_parent" || type === "batch_ccip_parent") {
    return null;
  }
  if (type === "processMedia") {
    const mode = getBoolean(job.payload, "skipMetadataExtraction")
      ? "metadata-skip"
      : "metadata-full";
    return targetId
      ? `${type}:${targetId}:${inputRevision ?? "current"}:${mode}`
      : null;
  }
  if (
    job.parentId &&
    (type === "auto_tagging" || type === "extract_ccip_vector") &&
    targetId
  ) {
    return `${type}:${job.parentId}:${targetId}:${inputRevision ?? "current"}:${force}`;
  }
  return targetId ? `${type}:${targetId}:${inputRevision ?? "current"}:${force}` : null;
}

function buildConcurrencyKey(type: JobType, targetId: string | null, job: NewJob): string | null {
  if (type === "sync_lancedb" || type === "sync_lancedb_full" || type === "sync_lancedb_delta") {
    return job.mediaSourceId ? `lancedb:${job.mediaSourceId}` : null;
  }
  if (type === "auto_tagging" || type === "extract_ccip_vector" || type === "processMedia") {
    return targetId ? `media:${targetId}:${type}` : null;
  }
  return null;
}

function getString(payload: unknown, key: string): string | null {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function getBoolean(payload: unknown, key: string): boolean {
  return isRecord(payload) && payload[key] === true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
