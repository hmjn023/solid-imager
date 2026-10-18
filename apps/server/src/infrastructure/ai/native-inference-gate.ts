import { AiInferenceBusyError } from "@solid-imager/core/domain/errors";
export { AiInferenceBusyError } from "@solid-imager/core/domain/errors";

export class NativeInferenceGate {
	private active = false;
	private readonly waiting: Array<() => void> = [];
	constructor(private readonly maxWaiting = 16) {}

	async run<T>(infer: () => T | Promise<T>): Promise<T> {
		if (this.active) {
			if (this.waiting.length >= this.maxWaiting)
				throw new AiInferenceBusyError();
			await new Promise<void>((resolve) => this.waiting.push(resolve));
		} else {
			this.active = true;
		}
		try {
			// Keep the slot until the native call really finishes, including after HTTP disconnect.
			return await infer();
		} finally {
			const next = this.waiting.shift();
			if (next) next();
			else this.active = false;
		}
	}
}

// Vite route/module graphs and separate RustAiClient instances must share one native budget.
const host = globalThis as typeof globalThis & {
	__SOLID_IMAGER_NATIVE_INFERENCE__?: NativeInferenceGate;
};
export const nativeInferenceGate = (host.__SOLID_IMAGER_NATIVE_INFERENCE__ ??=
	new NativeInferenceGate());
