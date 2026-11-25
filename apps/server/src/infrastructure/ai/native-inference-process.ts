import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { z } from "zod";
import {
	resolveDghsImgutilsPath,
	type DghsImgutilsModule,
} from "./dghs-imgutils-loader";

// Keep the entry point self-contained when Nitro bundles the server.
const childSource = `
const {createReadStream,createWriteStream} = require("node:fs");
const replies = createWriteStream(null, {fd: 3});
const native = require(process.argv[1]);
const lines = require("node:readline").createInterface({input:createReadStream(null, {fd: 0})});
lines.on("close", () => process.exit(0));
lines.on("line", async line => {
	const {id,method,args} = JSON.parse(line);
	try {
		// Keep PNG bytes out of the JSON channel's per-byte number arrays.
		const value = method === "segmentPngBase64"
			? Buffer.from(await native.segmentRgbaWithIsnetis(...args)).toString("base64")
			: await native[method](...args);
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
	ccipDistances: (feature: number[], candidates: number[][]) => number[];
};

export class NativeInferenceProcess {
	private child?: ReturnType<NativeInferenceProcess["start"]>;
	private nextId = 0;
	private readonly pending = new Map<
		number,
		{ resolve: (v: unknown) => void; reject: (error: Error) => void }
	>();

	private start() {
		const child = spawn(
			process.execPath,
			["-e", childSource, resolveDghsImgutilsPath()],
			{
				// Reserve fd 3 for replies. Native libraries can write logs directly to stdout.
				stdio: ["pipe", 2, "inherit", "pipe"],
			},
		);
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

	async offload() {
		const worker = this.child;
		if (!worker) return;
		const { child, stdin, exited } = worker;
		try {
			await this.call("offloadInferenceSessions");
		} finally {
			// Providers and the allocator can retain large arenas after session eviction.
			child.ref();
			stdin.end();
			const fallback = setTimeout(
				() => worker.kill("process did not exit after offload"),
				2000,
			);
			try {
				await exited;
			} finally {
				clearTimeout(fallback);
			}
		}
	}
}

export const nativeInferenceProcess = new NativeInferenceProcess();
