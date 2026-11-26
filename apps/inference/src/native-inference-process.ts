import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { NapiInferenceOptions } from "dghs-imgutils-rs";
import { z } from "zod";
import {
	resolveDghsImgutilsPath,
	type DghsImgutilsModule,
} from "./dghs-imgutils-loader";

// Isolate model sessions and their native allocations in a replaceable child.
const childSource = `
const {createReadStream,createWriteStream} = require("node:fs");
const replies = createWriteStream(null, {fd: 3});
const native = require(process.argv[1]);
if (process.argv[2]) native.configureInference(JSON.parse(process.argv[2]));
const lines = require("node:readline").createInterface({input:createReadStream(null, {fd: 0})});
lines.on("close", () => process.exit(0));
async function ccipDistances(feature, candidates, modelName) {
	if (typeof native.ccipDistances === "function") {
		return native.ccipDistances(feature, candidates, modelName);
	}
	const distances = [];
	for (let start = 0; start < candidates.length; start += 16) {
		const batch = await Promise.all(candidates.slice(start, start + 16).map(
			(candidate) => native.ccipDistance(feature, candidate, modelName),
		));
		distances.push(...batch);
	}
	return distances;
}
const methods = {
	...native,
	ccipDistances,
	async segmentPngBase64(...args) {
		return Buffer.from(await native.segmentRgbaWithIsnetis(...args)).toString("base64");
	},
};
lines.on("line", async line => {
	const {id,method,args} = JSON.parse(line);
	try {
		const value = await methods[method](...args);
		replies.write(JSON.stringify({id,value}) + "\\n");
	} catch (error) {
		replies.write(JSON.stringify({id,error:error instanceof Error ? error.message : String(error)}) + "\\n");
	}
});
`;

const responseSchema = z.object({
	id: z.number(),
	error: z.string().optional(),
	value: z.unknown().optional(),
});
type Method =
	| "probeInferenceBackends"
	| "getPixaiTags"
	| "getOppaioracleTags"
	| "ccipGetEmbedding"
	| "ccipDistance"
	| "ccipDistances"
	| "detectPerson"
	| "segmentPngBase64"
	| "embeddinggemma2TextEncode"
	| "embeddinggemma2ImageEncode"
	| "offloadInferenceSessions";
type NativeMethods = DghsImgutilsModule & {
	segmentPngBase64: (
		...args: Parameters<DghsImgutilsModule["segmentRgbaWithIsnetis"]>
	) => string;
	ccipDistances: (
		feature: number[],
		candidates: number[][],
		modelName: string,
	) => number[];
};

export class NativeInferenceProcess {
	private child?: ReturnType<NativeInferenceProcess["start"]>;
	private nextId = 0;
	private readonly pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (error: Error) => void }
	>();

	constructor(private readonly options?: NapiInferenceOptions) {}

	private start() {
		const args = ["-e", childSource, resolveDghsImgutilsPath()];
		if (this.options) args.push(JSON.stringify(this.options));
		const child = spawn(process.execPath, args, {
			// Reserve fd 3 for replies. Native libraries can write logs directly to stdout.
			stdio: ["pipe", 2, "inherit", "pipe"],
		});
		const stdin = child.stdin;
		const replies = child.stdio[3];
		if (!stdin || !(replies instanceof Readable)) {
			child.kill();
			throw new Error("Inference process pipes are unavailable");
		}
		const closed = Promise.withResolvers<void>();
		let stopReason: string | undefined;
		const worker = {
			child,
			stdin,
			exited: closed.promise,
			kill(reason: string) {
				if (!child.killed && child.kill("SIGKILL")) stopReason = reason;
			},
		};
		this.child = worker;
		const rejectPending = (error: Error) => {
			for (const request of this.pending.values()) request.reject(error);
			this.pending.clear();
		};
		child.on("error", rejectPending);
		child.once("close", (code, signal) => {
			if (this.child === worker) {
				this.child = undefined;
				const exit = `Inference process exited (${signal ?? code})`;
				rejectPending(new Error(stopReason ? `${exit}: ${stopReason}` : exit));
			}
			closed.resolve();
		});
		stdin.on("error", rejectPending);
		createInterface({ input: replies }).on("line", (line) => {
			let message: unknown;
			try {
				message = JSON.parse(line);
			} catch {
				worker.kill("invalid JSON on the reply pipe");
				return;
			}
			const result = responseSchema.safeParse(message);
			if (!result.success) {
				worker.kill("invalid message on the reply pipe");
				return;
			}
			const { id, error, value } = result.data;
			const request = this.pending.get(id);
			if (error !== undefined) request?.reject(new Error(error));
			else request?.resolve(value);
		});
		child.unref();

		return worker;
	}

	async call<K extends Method>(
		method: K,
		...args: Parameters<NativeMethods[K]>
	): Promise<Awaited<ReturnType<NativeMethods[K]>>> {
		const worker = this.child ?? this.start();
		const { child, stdin } = worker;
		const id = ++this.nextId;
		const request = Promise.withResolvers<unknown>();
		this.pending.set(id, request);
		child.ref();
		const timeout = setTimeout(
			() => worker.kill(`request timed out (${method})`),
			10 * 60 * 1000,
		);
		try {
			stdin.write(JSON.stringify({ id, method, args }) + "\n", (error) => {
				if (error) request.reject(error);
			});
			// The child serializes the result for the requested method before replying with this ID.
			return (await request.promise) as Awaited<ReturnType<NativeMethods[K]>>;
		} finally {
			clearTimeout(timeout);
			this.pending.delete(id);
			if (!this.pending.size) child.unref();
		}
	}

	private async close(worker: NonNullable<NativeInferenceProcess["child"]>) {
		const { child, stdin, exited } = worker;
		child.ref();
		stdin.end();
		const fallback = setTimeout(
			() => worker.kill("process did not exit after closing stdin"),
			2000,
		);
		try {
			await exited;
		} finally {
			clearTimeout(fallback);
		}
	}

	async stop(): Promise<void> {
		if (this.child) await this.close(this.child);
	}

	async offload(): Promise<void> {
		const worker = this.child;
		if (!worker) return;
		try {
			await this.call("offloadInferenceSessions");
		} finally {
			// Providers and allocators can retain large arenas after session eviction.
			await this.close(worker);
		}
	}
}
