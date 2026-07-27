/// <reference types="bun-types" />
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const reportSchema = z.object({
	ok: z.boolean(),
	serverMajor: z.number().int(),
	serverVersionNum: z.number().int(),
	serverVersion: z.string(),
	vectorAvailable: z.boolean(),
	vectorVersion: z.string().nullable(),
	migrations: z.array(
		z.object({
			id: z.number().int(),
			hash: z.string(),
			createdAt: z.number().int(),
		}),
	),
	constraints: z.array(
		z.object({
			name: z.string(),
			type: z.string(),
			definition: z.string(),
			validated: z.boolean(),
		}),
	),
	invalidConstraintCount: z.number().int().nonnegative(),
	tableCounts: z.record(z.string(), z.number().int().nonnegative()),
	readWriteProbe: z.literal(true),
	vectorProbe: z.boolean(),
	mismatches: z.array(z.string()),
});

type ValidationReport = z.infer<typeof reportSchema>;
type Options = {
	composeFile: string;
	service: string;
	expectedReport?: string;
	output?: string;
	expectedMajor: number;
	expectVectorAvailable: boolean;
	expectedVectorVersion?: string;
	allowedAddedTableCounts: Map<string, number>;
};

const defaultAllowedAddedTableCounts = new Map([
	["ccip_embeddings", 0],
	["media_regions", 0],
]);

function valueAfter(args: string[], index: number, option: string): string {
	const value = args[index + 1];
	if (!value) throw new Error(`${option} requires a value`);
	return value;
}

function parseOptions(args: string[]): Options {
	const options: Options = {
		composeFile: path.join(repoRoot, "compose.pg18-rehearsal.yml"),
		service: "db-pg18-rehearsal",
		expectedMajor: 18,
		expectVectorAvailable: true,
		expectedVectorVersion: "0.8.5",
		allowedAddedTableCounts: new Map(defaultAllowedAddedTableCounts),
	};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--compose-file") {
			options.composeFile = path.resolve(
				valueAfter(args, index, "--compose-file"),
			);
			index += 1;
		} else if (argument === "--service") {
			options.service = valueAfter(args, index, "--service");
			index += 1;
		} else if (argument === "--expected-report") {
			options.expectedReport = path.resolve(
				valueAfter(args, index, "--expected-report"),
			);
			index += 1;
		} else if (argument === "--output") {
			options.output = path.resolve(valueAfter(args, index, "--output"));
			index += 1;
		} else if (argument === "--expected-major") {
			const value = Number.parseInt(
				valueAfter(args, index, "--expected-major"),
				10,
			);
			if (!Number.isSafeInteger(value) || value < 10) {
				throw new Error("--expected-major must be a PostgreSQL major version");
			}
			options.expectedMajor = value;
			index += 1;
		} else if (argument === "--expected-vector-version") {
			options.expectedVectorVersion = valueAfter(
				args,
				index,
				"--expected-vector-version",
			);
			index += 1;
		} else if (argument === "--allow-any-vector-version") {
			options.expectVectorAvailable = true;
			options.expectedVectorVersion = undefined;
		} else if (argument === "--expect-vector-unavailable") {
			options.expectVectorAvailable = false;
			options.expectedVectorVersion = undefined;
		} else if (argument === "--allow-added-table") {
			const value = valueAfter(args, index, "--allow-added-table");
			const match = /^([a-z][a-z0-9_]*)=(\d+)$/.exec(value);
			if (!match) {
				throw new Error(
					"--allow-added-table must use the form table_name=expected_count",
				);
			}
			options.allowedAddedTableCounts.set(
				match[1],
				parseInteger(match[2], `${match[1]} expected row count`),
			);
			index += 1;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	return options;
}

async function query(options: Options, sql: string): Promise<string> {
	const databaseUser = process.env.DB_USER ?? "postgres";
	const databaseName = process.env.DB_DATABASE ?? "solid-imager";
	const processHandle = Bun.spawn(
		[
			"docker",
			"compose",
			"-f",
			options.composeFile,
			"exec",
			"-T",
			options.service,
			"psql",
			"-X",
			"--set=ON_ERROR_STOP=1",
			"--username",
			databaseUser,
			"--dbname",
			databaseName,
			"--tuples-only",
			"--no-align",
			"--command",
			sql,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(processHandle.stdout).text(),
		new Response(processHandle.stderr).text(),
		processHandle.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`psql exited with ${exitCode}: ${stderr.trim()}`);
	}
	return stdout.trim();
}

function parseInteger(value: string, name: string): number {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed) || parsed < 0) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
	return parsed;
}

async function collectReport(options: Options): Promise<ValidationReport> {
	await query(options, "ANALYZE;");
	const metadata = z
		.object({
			serverVersionNum: z.number().int(),
			serverVersion: z.string(),
			vectorVersion: z.string().nullable(),
			invalidConstraintCount: z.number().int(),
		})
		.parse(
			JSON.parse(
				await query(
					options,
					`SELECT json_build_object(
						'serverVersionNum', current_setting('server_version_num')::integer,
						'serverVersion', version(),
						'vectorVersion', (SELECT extversion FROM pg_extension WHERE extname = 'vector'),
						'invalidConstraintCount', (SELECT count(*)::integer FROM pg_constraint WHERE NOT convalidated)
					)::text;`,
				),
			),
		);
	const tableNamesOutput = await query(
		options,
		"SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
	);
	const tableNames = tableNamesOutput ? tableNamesOutput.split("\n") : [];
	const tableCounts: Record<string, number> = {};
	for (const tableName of tableNames) {
		if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
			throw new Error(`Unsafe table name returned by PostgreSQL: ${tableName}`);
		}
		tableCounts[tableName] = parseInteger(
			await query(options, `SELECT count(*) FROM public."${tableName}";`),
			`${tableName} row count`,
		);
	}
	const migrations = z
		.array(
			z.object({
				id: z.number().int(),
				hash: z.string(),
				createdAt: z.number().int(),
			}),
		)
		.parse(
			JSON.parse(
				await query(
					options,
					"SELECT coalesce(json_agg(json_build_object('id', id, 'hash', hash, 'createdAt', created_at) ORDER BY created_at), '[]'::json)::text FROM drizzle.__drizzle_migrations;",
				),
			),
		);
	const constraints = z
		.array(
			z.object({
				name: z.string(),
				type: z.string(),
				definition: z.string(),
				validated: z.boolean(),
			}),
		)
		.parse(
			JSON.parse(
				await query(
					options,
					`SELECT coalesce(json_agg(
						json_build_object(
							'name', constraint.conname,
							'type', constraint.contype::text,
							'definition', regexp_replace(pg_get_constraintdef(constraint.oid, true), '\\s+', ' ', 'g'),
							'validated', constraint.convalidated
						)
						ORDER BY constraint.conname
					), '[]'::json)::text
					FROM pg_constraint constraint
					INNER JOIN pg_namespace namespace ON namespace.oid = constraint.connamespace
					WHERE namespace.nspname = 'public';`,
				),
			),
		);
	const readWriteProbe =
		(await query(
			options,
			"BEGIN; CREATE TEMP TABLE pg18_rehearsal_probe(value integer); INSERT INTO pg18_rehearsal_probe VALUES (1); SELECT count(*) FROM pg18_rehearsal_probe; ROLLBACK;",
		)).includes("1");
	const vectorAvailable = metadata.vectorVersion !== null;
	const vectorProbe = vectorAvailable
		? (await query(
				options,
				"SELECT ('[1,0,0]'::vector <=> '[1,0,0]'::vector) = 0;",
			)) === "t"
		: false;
	if (!readWriteProbe) {
		throw new Error("PostgreSQL read/write validation failed");
	}
	const serverMajor = Math.floor(metadata.serverVersionNum / 10_000);
	const mismatches: string[] = [];
	if (serverMajor !== options.expectedMajor) {
		mismatches.push(
			`PostgreSQL major: expected ${options.expectedMajor}, got ${serverMajor}`,
		);
	}
	if (vectorAvailable !== options.expectVectorAvailable) {
		mismatches.push(
			`vector extension availability: expected ${options.expectVectorAvailable}, got ${vectorAvailable}`,
		);
	}
	if (vectorAvailable && !vectorProbe) {
		mismatches.push("vector extension probe failed");
	}
	if (
		options.expectVectorAvailable &&
		options.expectedVectorVersion &&
		metadata.vectorVersion !== options.expectedVectorVersion
	) {
		mismatches.push(
			`vector extension: expected ${options.expectedVectorVersion}, got ${metadata.vectorVersion}`,
		);
	}
	if (metadata.invalidConstraintCount !== 0) {
		mismatches.push(
			`invalid constraints: expected 0, got ${metadata.invalidConstraintCount}`,
		);
	}
	return {
		ok: mismatches.length === 0,
		serverMajor,
		...metadata,
		vectorAvailable,
		migrations,
		constraints,
		tableCounts,
		readWriteProbe: true,
		vectorProbe,
		mismatches,
	};
}

function compareReports(
	report: ValidationReport,
	expected: ValidationReport,
	allowedAddedTableCounts: ReadonlyMap<string, number>,
): string[] {
	const mismatches: string[] = [];
	const expectedTableNames = Object.keys(expected.tableCounts).sort();
	const actualTableNames = Object.keys(report.tableCounts).sort();
	const unexpectedAddedTableNames = actualTableNames.filter(
		(tableName) =>
			!expectedTableNames.includes(tableName) &&
			!allowedAddedTableCounts.has(tableName),
	);
	if (unexpectedAddedTableNames.length > 0) {
		mismatches.push(
			`unexpected target-only tables: ${unexpectedAddedTableNames.join(",")}`,
		);
	}
	for (const [tableName, expectedCount] of Object.entries(expected.tableCounts)) {
		const actualCount = report.tableCounts[tableName];
		if (actualCount !== expectedCount) {
			mismatches.push(
				`table ${tableName}: expected ${expectedCount}, got ${actualCount ?? "missing"}`,
			);
		}
	}
	for (const [tableName, expectedCount] of allowedAddedTableCounts) {
		if (Object.hasOwn(expected.tableCounts, tableName)) continue;
		const actualCount = report.tableCounts[tableName];
		if (actualCount !== expectedCount) {
			mismatches.push(
				`target-only table ${tableName}: expected ${expectedCount}, got ${actualCount ?? "missing"}`,
			);
		}
	}
	for (let index = 0; index < expected.migrations.length; index += 1) {
		const expectedMigration = expected.migrations[index];
		const actualMigration = report.migrations[index];
		if (
			!actualMigration ||
			actualMigration.id !== expectedMigration.id ||
			actualMigration.hash !== expectedMigration.hash
		) {
			mismatches.push(
				`migration prefix mismatch at position ${index}: expected ${expectedMigration.id}/${expectedMigration.hash}, got ${actualMigration ? `${actualMigration.id}/${actualMigration.hash}` : "missing"}`,
			);
		}
	}
	const actualConstraints = new Map(
		report.constraints.map((constraint) => [constraint.name, constraint]),
	);
	for (const expectedConstraint of expected.constraints) {
		const actualConstraint = actualConstraints.get(expectedConstraint.name);
		if (
			!actualConstraint ||
			actualConstraint.type !== expectedConstraint.type ||
			actualConstraint.definition !== expectedConstraint.definition ||
			actualConstraint.validated !== expectedConstraint.validated
		) {
			mismatches.push(`constraint mismatch: ${expectedConstraint.name}`);
		}
	}
	return mismatches;
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const report = await collectReport(options);
	if (options.expectedReport) {
		const expected = reportSchema.parse(
			JSON.parse(await readFile(options.expectedReport, "utf8")),
		);
		report.mismatches = [
			...report.mismatches,
			...compareReports(report, expected, options.allowedAddedTableCounts),
		];
		report.ok = report.mismatches.length === 0;
	}
	const output = `${JSON.stringify(report, null, 2)}\n`;
	if (options.output) {
		const partial = `${options.output}.partial`;
		await writeFile(partial, output, { flag: "wx" });
		await rename(partial, options.output);
	} else {
		process.stdout.write(output);
	}
	if (!report.ok) process.exitCode = 1;
}

await main();
