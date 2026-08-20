import type { AiConfig } from "@solid-imager/core/domain/config/config-schema";
import type { NapiInferenceOptions } from "dghs-imgutils-rs";

type InferenceConfig = Pick<AiConfig, "provider" | "device">;

const NATIVE_PROVIDER_BY_CONFIG: Record<AiConfig["provider"], string> = {
	amd_gpu: "amd_gpu",
	amd_npu: "amd_npu",
	auto: "auto",
	cpu: "cpu",
	cuda: "cuda",
	directml: "directml",
	intel_gpu: "intel_gpu",
	intel_npu: "intel_npu",
	openvino: "openvino",
	tensorrt: "tensorrt",
};

/** Converts the persisted AI configuration to the native provider selector. */
export function createNativeInferenceOptions(
	config: InferenceConfig,
): NapiInferenceOptions {
	const device = config.device?.trim();
	return {
		// dghs exports this as an ambient const enum, which cannot be referenced
		// at runtime with the server's isolatedModules setting. The explicit map
		// above keeps the values synchronized at this external package boundary.
		provider: NATIVE_PROVIDER_BY_CONFIG[
			config.provider
		] as NapiInferenceOptions["provider"],
		...(device ? { device } : {}),
	};
}
