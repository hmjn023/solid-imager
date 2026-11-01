import { parseArgs } from "node:util";
import pino from "pino";
import { ZodError } from "zod";
import { fit } from "./character-clustering/fit";
import { compareRuns } from "./character-clustering/compare";
import { extract } from "./character-clustering/extract";

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		args: process.argv.slice(2),
		allowPositionals: true,
		strict: true,
		options: {
			"graph-dir": { type: "string" },
			output: { type: "string" },
			neighbors: { type: "string" },
			"min-cluster-size": { type: "string", default: "5" },
			"min-samples": { type: "string", default: "3" },
			"selection-method": { type: "string", default: "leaf" },
			help: { type: "boolean", short: "h" },
			"ef-search": { type: "string", default: "256" },
			"batch-size": { type: "string", default: "128" },
			"recall-samples": { type: "string", default: "16" },
			"source-id": { type: "string" },
			"include-without-solo": { type: "boolean" },
			runs: { type: "string", multiple: true },
		},
	});

	if (values.help) {
		process.stdout.write(
			"bun scripts/cluster-characters.ts extract --output NEW_PATH [--neighbors 64] [--ef-search 256] [--source-id UUID] [--include-without-solo]\nbun scripts/cluster-characters.ts fit --graph-dir PATH --output NEW_PATH [--neighbors 32] [--min-cluster-size 5] [--min-samples 1] [--selection-method eom|leaf]\nbun scripts/cluster-characters.ts compare --runs RUN_A --runs RUN_B --output NEW_PATH\n",
		);
	} else if (
		positionals.length === 1 &&
		positionals[0] === "extract" &&
		values.output
	) {
		const summary = await extract(values.output, {
			neighbors: Number(values.neighbors ?? "64"),
			efSearch: Number(values["ef-search"]),
			batchSize: Number(values["batch-size"]),
			recallSamples: Number(values["recall-samples"]),
			sourceId: values["source-id"],
			soloOnly: !values["include-without-solo"],
		});
		process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
	} else if (
		positionals.length === 1 &&
		positionals[0] === "compare" &&
		values.runs &&
		values.output
	) {
		const summary = await compareRuns(values.runs, values.output);
		process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
	} else if (
		positionals.length === 1 &&
		positionals[0] === "fit" &&
		values["graph-dir"] &&
		values.output
	) {
		const summary = await fit(values["graph-dir"], values.output, {
			neighbors:
				values.neighbors === undefined ? undefined : Number(values.neighbors),
			minClusterSize: Number(values["min-cluster-size"]),
			minSamples: Number(values["min-samples"]),
			selectionMethod: values["selection-method"],
		});
		process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
	} else {
		throw new Error(
			"Expected fit --graph-dir PATH --output NEW_PATH; use --help",
		);
	}
}

try {
	await main();
} catch (error) {
	const logger = pino({ level: "error" }, pino.destination(2));
	if (error instanceof ZodError)
		logger.error(
			{ issues: error.issues.slice(0, 5), issueCount: error.issues.length },
			"Invalid clustering input",
		);
	else logger.error({ err: error }, "Character clustering failed");
	process.exitCode = 1;
}
