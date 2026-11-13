import { t } from "@solid-imager/i18n";
import { type AiProvider, AiProviderSchema } from "@solid-imager/core/config";
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
	{ value: "auto", label: t("inferenceDeviceFields.automatic") },
	{ value: "cpu", label: t("inferenceDeviceFields.cPU") },
	{ value: "cuda", label: t("inferenceDeviceFields.nVIDIACUDA") },
	{ value: "tensorrt", label: t("inferenceDeviceFields.nVIDIATensorRT") },
	{ value: "directml", label: t("inferenceDeviceFields.directML") },
	{ value: "intel_gpu", label: t("inferenceDeviceFields.intelGPU") },
	{ value: "intel_npu", label: t("inferenceDeviceFields.intelNPU") },
	{ value: "amd_gpu", label: t("inferenceDeviceFields.aMDGPU") },
	{ value: "amd_npu", label: t("inferenceDeviceFields.aMDNPU") },
	{ value: "openvino", label: t("inferenceDeviceFields.openVINO") },
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
			return t("inferenceDeviceFields.0Or12");
		case "intel_gpu":
			return t("inferenceDeviceFields.0OrGPU0");
		case "intel_npu":
			return t("inferenceDeviceFields.0OrNPU0");
		case "openvino":
			return t("labels.openVinoExample");
		default:
			return t("inferenceDeviceFields.notRequiredByThisProvider");
	}
}

function getDeviceDescription(provider: AiProvider): string {
	switch (provider) {
		case "auto":
			return t(
				"inferenceDeviceFields.automaticallySelectsAnAvailableProviderFallingBackToCPU",
			);
		case "cpu":
		case "amd_npu":
			return t("inferenceDeviceFields.thisProviderDoesNotUseADeviceSelector");
		case "intel_gpu":
			return t("inferenceDeviceFields.enterAnIntelGPUIndexLeaveEmptyToUse");
		case "intel_npu":
			return t("inferenceDeviceFields.enterAnIntelNPUIndexLeaveEmptyToUse");
		case "openvino":
			return t(
				"inferenceDeviceFields.specifyTheOpenVINODevicePolicySuchAsAUTOGPU",
			);
		default:
			return t(
				"inferenceDeviceFields.enterTheProviderSpecificDeviceIndexDefaultsTo0",
			);
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
				<Label id={`${idPrefix()}-provider-label`}>
					{t("inferenceDeviceFields.inferenceProvider")}
				</Label>
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
							{(state) =>
								state.selectedOption()?.label ??
								t("inferenceDeviceFields.automatic")
							}
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
					{t(
						"inferenceDeviceFields.selectAProviderForLocalInferenceRemoteAIServers",
					)}
				</p>
			</div>

			<div class="space-y-2">
				<Label for={`${idPrefix()}-device`}>
					{t("inferenceDeviceFields.deviceOptional")}
				</Label>
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
						{t(
							"inferenceDeviceFields.theSelectedProviderDoesNotUseADeviceSelector",
						)}
					</p>
				</Show>
			</div>
		</div>
	);
}
