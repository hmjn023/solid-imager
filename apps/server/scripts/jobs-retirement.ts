import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createJobRetirementRepository } from "@solid-imager/db/repositories/job-retirement-repository";
import {
	jobObservationSchema,
	assessJobObservation,
} from "@solid-imager/core/domain/jobs/schemas";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { logger } from "../src/infrastructure/logger";
import { withMaintenanceDatabase } from "./maintenance-database";

const mode = process.argv[2] ?? "inspect";
if (
	!["inspect", "activate", "rollback", "begin-observation", "sample"].includes(
		mode,
	)
)
	throw new Error(
		"Use inspect, activate, rollback, begin-observation or sample",
	);
const option = (name: string) => {
	const index = process.argv.indexOf(name);
	return index < 0 ? undefined : process.argv[index + 1];
};
const days = (name: string, fallback: number) => {
	const number = Number(option(name) ?? fallback);
	if (!Number.isInteger(number) || number < 1 || number > 365)
		throw new Error("Observation days must be between 1 and 365");
	return number;
};
if (
	["activate", "rollback"].includes(mode) &&
	!process.argv.includes("--writers-stopped")
)
	throw new Error("Stop/drain every writer, then pass --writers-stopped");
const evidence = option("--evidence");
if (["begin-observation", "sample"].includes(mode) && !evidence)
	throw new Error("Provide an owned --evidence path");
await withMaintenanceDatabase(async (database) => {
	const repo = createJobRetirementRepository(
		(tx) => (tx ?? database) as DrizzleExecutor,
	);
	if (mode === "inspect")
		logger.info(
			await repo.inspect(),
			"Generic jobs migration audit (this inspection reads jobs; run before the observation baseline)",
		);
	else if (mode === "activate") {
		await repo.initialize();
		logger.info("Generic jobs write fence activated; no table was dropped");
	} else if (mode === "rollback") {
		await repo.rollback();
		logger.info(
			"Final write fence released; follow family runbooks and archived parent dependencies before restoring legacy writers",
		);
	} else if (mode === "begin-observation") {
		const backup = option("--backup-reference");
		if (!backup)
			throw new Error(
				"Record the verified archive/database/storage backup with --backup-reference",
			);
		if (!process.argv.includes("--statistics-reset-audited"))
			throw new Error(
				"Audit privileged statistics-reset operations and pass --statistics-reset-audited; table counters alone cannot prove that no reset occurred",
			);
		// Inspection runs in an earlier, closed connection; sampling must not count its own reads.
		await repo.assertRetired();
		const baseline = await repo.sampleActivity();
		const observation = jobObservationSchema.parse({
			version: 1,
			baseline,
			last: baseline,
			observationUntil: new Date(
				+baseline.sampledAt + days("--days", 7) * 86400000,
			),
			rollbackUntil: new Date(
				+baseline.sampledAt + days("--rollback-days", 14) * 86400000,
			),
			backupReference: backup,
			passed: false,
			violations: [],
		});
		if (!evidence) throw new Error("Missing evidence path");
		await fs.mkdir(path.dirname(path.resolve(evidence)), { recursive: true });
		await fs.writeFile(evidence, JSON.stringify(observation, null, 2) + "\n", {
			flag: "wx",
			mode: 0o600,
		});
		logger.info(
			{
				evidence,
				observationUntil: observation.observationUntil,
				rollbackUntil: observation.rollbackUntil,
			},
			"Observation baseline recorded; production observation has just started",
		);
	} else {
		if (!evidence) throw new Error("Missing evidence path");
		const lock = await fs.open(evidence + ".lock", "wx", 0o600),
			temporary = evidence + ".partial." + randomUUID();
		try {
			if ((await fs.stat(evidence)).size > 1024 * 1024)
				throw new Error("Observation evidence exceeds 1 MiB");
			await repo.assertRetired();
			const previous = jobObservationSchema.parse(
				JSON.parse(await fs.readFile(evidence, "utf8")),
			);
			const current = assessJobObservation(
				previous,
				await repo.sampleActivity(),
			);
			await fs.writeFile(temporary, JSON.stringify(current, null, 2) + "\n", {
				flag: "wx",
				mode: 0o600,
			});
			await fs.rename(temporary, evidence);
			logger.info(
				{
					counterWindowPassed: current.passed,
					violations: current.violations,
					observationUntil: current.observationUntil,
					rollbackUntil: current.rollbackUntil,
				},
				"Jobs counter observation; final DROP still requires DBA reset audit and verified backups",
			);
		} finally {
			await fs.rm(temporary, { force: true });
			await lock.close();
			await fs.rm(evidence + ".lock", { force: true });
		}
	}
});
