import { probeInferenceBackends } from "dghs-imgutils-rs";

const cpuBackend = probeInferenceBackends({
	backend: "cpu",
	precision: "fp32",
}).find((backend) => backend.backend === "cpu");

if (!cpuBackend?.available) {
	const reason = cpuBackend?.reason ? `: ${cpuBackend.reason}` : "";
	throw new Error(`CPU ONNX Runtime provider is unavailable${reason}`);
}
