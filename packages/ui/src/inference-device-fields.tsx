import {
	type AiProvider,
	AiProviderSchema,
} from "@solid-imager/core/domain/config/config-schema";
import { Show } from "solid-js";
import { FormFieldMessage } from "./form-message";
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { cn } from "./utils/cn";

type ProviderOption = {
	value: AiProvider;
	label: string;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
	{ value: "auto", label: "自動選択 (Auto)" },
	{ value: "cpu", label: "CPU" },
	{ value: "cuda", label: "NVIDIA CUDA" },
	{ value: "tensorrt", label: "NVIDIA TensorRT" },
	{ value: "directml", label: "DirectML" },
	{ value: "intel_gpu", label: "Intel GPU" },
	{ value: "intel_npu", label: "Intel NPU" },
	{ value: "amd_gpu", label: "AMD GPU" },
	{ value: "amd_npu", label: "AMD NPU" },
	{ value: "openvino", label: "OpenVINO" },
];

const PROVIDERS_WITHOUT_DEVICE: ReadonlySet<AiProvider> = new Set([
	"auto",
	"cpu",
	"amd_npu",
]);

function supportsDevice(provider: AiProvider): boolean {
	return !PROVIDERS_WITHOUT_DEVICE.has(provider);
}

function getDevicePlaceholder(provider: AiProvider): string {
	switch (provider) {
		case "cuda":
		case "tensorrt":
		case "directml":
		case "amd_gpu":
			return "0 (または 1, 2...)";
		case "intel_gpu":
			return "0 または GPU.0";
		case "intel_npu":
			return "0 または NPU.0";
		case "openvino":
			return "AUTO, GPU, NPU, HETERO:GPU,CPU";
		default:
			return "このproviderでは不要";
	}
}

function getDeviceDescription(provider: AiProvider): string {
	switch (provider) {
		case "auto":
			return "利用可能なproviderを自動選択し、最後にCPUへフォールバックします。";
		case "cpu":
		case "amd_npu":
			return "このproviderはdevice selectorを使用しません。";
		case "intel_gpu":
			return "Intel GPUの番号を指定できます。省略時はproviderの既定値を使用します。";
		case "intel_npu":
			return "Intel NPUの番号を指定できます。省略時はproviderの既定値を使用します。";
		case "openvino":
			return "OpenVINOのdevice policyを指定します。例: AUTO、GPU、NPU、HETERO:GPU,CPU。";
		default:
			return "provider固有のdevice番号を指定できます。省略時は0を使用します。";
	}
}

export type InferenceDeviceFieldsProps = {
	provider: AiProvider;
	device?: string;
	providerError?: string;
	deviceError?: string;
	onProviderChange: (provider: AiProvider) => void;
	onDeviceChange: (device: string) => void;
	class?: string;
	idPrefix?: string;
};

/** Renders the shared provider/device controls for local inference settings. */
export function InferenceDeviceFields(props: InferenceDeviceFieldsProps) {
	const idPrefix = () => props.idPrefix ?? "ai-inference";
	const selectedOption = () =>
		PROVIDER_OPTIONS.find((option) => option.value === props.provider) ??
		PROVIDER_OPTIONS[0];
	const deviceIsSupported = () => supportsDevice(props.provider);
	const deviceDescriptionId = () => `${idPrefix()}-device-description`;

	return (
		<div class={cn("grid gap-4 md:grid-cols-2", props.class)}>
			<div class="space-y-2">
				<Label id={`${idPrefix()}-provider-label`}>推論provider</Label>
				<Select
					aria-describedby={`${idPrefix()}-provider-description ${idPrefix()}-provider-error`}
					aria-invalid={Boolean(props.providerError)}
					aria-labelledby={`${idPrefix()}-provider-label`}
					itemComponent={(itemProps) => (
						<SelectItem item={itemProps.item}>
							{itemProps.item.rawValue.label}
						</SelectItem>
					)}
					onChange={(value) => {
						if (value) {
							const provider = AiProviderSchema.parse(value.value);
							props.onProviderChange(provider);
							if (provider !== props.provider && props.device) {
								props.onDeviceChange("");
							}
						}
					}}
					options={PROVIDER_OPTIONS}
					optionTextValue="label"
					optionValue="value"
					value={selectedOption()}
				>
					<SelectTrigger>
						<SelectValue<ProviderOption>>
							{(state) => state.selectedOption()?.label ?? "自動選択 (Auto)"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
				<FormFieldMessage
					id={`${idPrefix()}-provider-error`}
					message={props.providerError}
				/>
				<p
					class="text-muted-foreground text-xs"
					id={`${idPrefix()}-provider-description`}
				>
					ローカル推論に使用するproviderを選択します。リモートAIサーバー指定時はリモート側の設定が適用されます。
				</p>
			</div>

			<div class="space-y-2">
				<Label for={`${idPrefix()}-device`}>Device (任意)</Label>
				<Input
					aria-describedby={`${deviceDescriptionId()} ${idPrefix()}-device-error`}
					aria-invalid={Boolean(props.deviceError)}
					disabled={!deviceIsSupported()}
					id={`${idPrefix()}-device`}
					onInput={(event) => props.onDeviceChange(event.currentTarget.value)}
					placeholder={getDevicePlaceholder(props.provider)}
					value={props.device ?? ""}
				/>
				<FormFieldMessage
					id={`${idPrefix()}-device-error`}
					message={props.deviceError}
				/>
				<p class="text-muted-foreground text-xs" id={deviceDescriptionId()}>
					{getDeviceDescription(props.provider)}
				</p>
				<Show when={!deviceIsSupported()}>
					<p class="text-muted-foreground text-xs">
						現在のproviderではdevice指定は使用されません。
					</p>
				</Show>
			</div>
		</div>
	);
}
