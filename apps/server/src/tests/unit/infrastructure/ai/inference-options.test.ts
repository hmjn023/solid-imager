import { describe, expect, it } from "vitest";
import { createNativeInferenceOptions } from "~/infrastructure/ai/inference-options";

describe("createNativeInferenceOptions", () => {
	it.each([
		["auto", "auto"],
		["cpu", "cpu"],
		["cuda", "cuda"],
		["tensorrt", "tensorrt"],
		["directml", "directml"],
		["intel_gpu", "intel_gpu"],
		["intel_npu", "intel_npu"],
		["amd_gpu", "amd_gpu"],
		["amd_npu", "amd_npu"],
		["openvino", "openvino"],
	] as const)("maps %s to the native provider value", (provider, expected) => {
		expect(createNativeInferenceOptions({ provider })).toEqual({
			provider: expected,
		});
	});

	it("trims a configured device and omits blank values", () => {
		expect(
			createNativeInferenceOptions({
				provider: "intel_gpu",
				device: " GPU.0 ",
			}),
		).toEqual({
			provider: "intel_gpu",
			device: "GPU.0",
		});
		expect(
			createNativeInferenceOptions({ provider: "auto", device: "  " }),
		).toEqual({
			provider: "auto",
		});
	});
});
