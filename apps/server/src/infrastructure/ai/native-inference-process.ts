import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline";
import { z } from "zod";
import {
	resolveDghsImgutilsPath,
	type DghsImgutilsModule,
} from "./dghs-imgutils-loader";

// Keep the entry point self-contained when Nitro bundles the server.
const childSource = `
const native = require(process.argv[1]);
const lines = require("node:readline").createInterface({input:process.stdin});
lines.on("close", () => process.exit(0));
lines.on("line", async line => {
	const {id,method,args} = JSON.parse(line);
	try {
		const value = await native[method](...args);
		process.stdout.write(JSON.stringify({id,value}) + "\\n");
	} catch (error) {
		process.stdout.write(JSON.stringify({id,error:error instanceof Error ? error.message : String(error)}) + "\\n");
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
	| "segmentRgbaWithIsnetis"
	| "embeddinggemma2TextEncode"
	| "embeddinggemma2ImageEncode"
	| "offloadInferenceSessions";
type NativeMethods = DghsImgutilsModule & {
	ccipDistances: (feature: number[], candidates: number[][]) => number[];
};

export class NativeInferenceProcess {
	private child?: ChildProcessByStdio<Writable, Readable, null>;
	private exited: Promise<void> = Promise.resolve();
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
				stdio: ["pipe", "pipe", "inherit"],
			},
		);
		this.child = child;
		const closed = Promise.withResolvers<void>();
		this.exited = closed.promise;
		const rejectPending = (error: Error) => {
			for (const request of this.pending.values()) request.reject(error);
			this.pending.clear();
		};
		child.on("error", rejectPending);
		child.once("close", (code, signal) => {
			if (this.child === child) {
				this.child = undefined;
				rejectPending(
					new Error(`Inference process exited (${signal ?? code})`),
				);
			}
			closed.resolve();
		});
		child.stdin.on("error", rejectPending);
		createInterface({ input: child.stdout }).on("line", (line) => {
			let message: unknown;
			try {
				message = JSON.parse(line);
			} catch {
				child.kill("SIGKILL");
				return;
			}
			const result = responseSchema.safeParse(message);
			if (!result.success) {
				child.kill("SIGKILL");
				return;
			}
			const { id, error, value } = result.data;
			const request = this.pending.get(id);
			if (error !== undefined) request?.reject(new Error(error));
			else request?.resolve(value);
		});
		child.unref();

		return child;
	}

	async call<K extends Method>(
		method: K,
		...args: Parameters<NativeMethods[K]>
	): Promise<Awaited<ReturnType<NativeMethods[K]>>> {
		const child = this.child ?? this.start();
		const id = ++this.nextId;
		const request = Promise.withResolvers<unknown>();
		this.pending.set(id, request);
		child.ref();
		const timeout = setTimeout(() => child.kill("SIGKILL"), 10 * 60 * 1000);
		try {
			child.stdin.write(
				JSON.stringify({ id, method, args }) + "\n",
				(error) => {
					if (error) request.reject(error);
				},
			);
			// The isolated process invokes the corresponding function in this same installed native module.
			return (await request.promise) as Awaited<ReturnType<NativeMethods[K]>>;
		} finally {
			clearTimeout(timeout);
			this.pending.delete(id);
			if (!this.pending.size) child.unref();
		}
	}

	async offload() {
		const child = this.child;
		if (!child) return;
		const exited = this.exited;
		try {
			await this.call("offloadInferenceSessions");
		} finally {
			// Providers and the allocator can retain large arenas after session eviction.
			child.ref();
			child.stdin.end();
			const fallback = setTimeout(() => child.kill("SIGKILL"), 2000);
			try {
				await exited;
			} finally {
				clearTimeout(fallback);
			}
		}
	}
}

export const nativeInferenceProcess = new NativeInferenceProcess();
