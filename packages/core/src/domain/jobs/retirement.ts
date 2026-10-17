import { z } from "zod";
import { retiredBatchJobTypes } from "../batches/schemas";
import { retiredSourceJobTypes } from "../source-runs/schemas";

export const retiredGenericJobTypes = [
	"import_request",
	"downloadImage",
	...retiredBatchJobTypes,
	...retiredSourceJobTypes,
] as const;
export const legacyJobAuditSchema = z.object({
	authority: z.enum(["legacy", "retired"]),
	generation: z.number().int().nonnegative(),
	types: z.array(
		z.object({
			type: z.string(),
			status: z.string(),
			count: z.number().int().nonnegative(),
			known: z.boolean(),
		}),
	),
	authorities: z.array(
		z.object({
			family: z.string(),
			authority: z.string(),
			generation: z.number().int().nonnegative(),
		}),
	),
	active: z.number().int().nonnegative(),
	crossFamilyChildren: z.number().int().nonnegative(),
	brokenParents: z.number().int().nonnegative(),
	missingArchives: z.number().int().nonnegative(),
	archiveCounts: z.record(z.string(), z.number().int().nonnegative()),
});
export type LegacyJobAudit = z.infer<typeof legacyJobAuditSchema>;
export const jobActivitySampleSchema = z.object({
	sampledAt: z.coerce.date(),
	database: z.string(),
	databaseOid: z.string(),
	tableOid: z.string(),
	serverStartedAt: z.coerce.date(),
	statsResetAt: z.coerce.date().nullable(),
	trackCounts: z.literal(true),
	scans: z.number().int().nonnegative(),
	inserted: z.number().int().nonnegative(),
	updated: z.number().int().nonnegative(),
	deleted: z.number().int().nonnegative(),
});
export type JobActivitySample = z.infer<typeof jobActivitySampleSchema>;
export const jobObservationSchema = z.object({
	version: z.literal(1),
	baseline: jobActivitySampleSchema,
	last: jobActivitySampleSchema,
	observationUntil: z.coerce.date(),
	rollbackUntil: z.coerce.date(),
	backupReference: z.string().min(1),
	passed: z.boolean(),
	violations: z.array(z.string()),
});
export type JobObservation = z.infer<typeof jobObservationSchema>;

/** Stats resets, restarts or counter regressions invalidate the whole observation. */
export function assessJobObservation(
	observation: JobObservation,
	sample: JobActivitySample,
): JobObservation {
	const a = observation.baseline,
		previous = observation.last;
	const violations = [...observation.violations];
	if (
		a.database !== sample.database ||
		a.databaseOid !== sample.databaseOid ||
		a.tableOid !== sample.tableOid
	)
		violations.push("database_or_table_changed");
	if (
		+a.serverStartedAt !== +sample.serverStartedAt ||
		a.statsResetAt?.getTime() !== sample.statsResetAt?.getTime()
	)
		violations.push("statistics_epoch_changed");
	if (+sample.sampledAt <= +previous.sampledAt)
		violations.push("sample_time_did_not_advance");
	for (const key of ["scans", "inserted", "updated", "deleted"] as const) {
		if (sample[key] < previous[key])
			violations.push("counter_regressed:" + key);
		if (sample[key] !== a[key]) violations.push("jobs_activity:" + key);
	}
	const unique = [...new Set(violations)];
	return {
		...observation,
		last: sample,
		violations: unique,
		passed:
			unique.length === 0 &&
			+sample.sampledAt >= +observation.observationUntil &&
			+sample.sampledAt >= +observation.rollbackUntil,
	};
}
