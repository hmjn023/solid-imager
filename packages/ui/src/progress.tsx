// Adapted from the Solid UI v2 progress registry recipe.
import {
	ProgressIndicator as ProgressPrimitiveFill,
	ProgressLabel as ProgressPrimitiveLabel,
	Progress as ProgressPrimitiveRoot,
	ProgressTrack as ProgressPrimitiveTrack,
	ProgressValue as ProgressPrimitiveValueLabel,
} from "@ui-sdk/solid/progress";
import type { Component } from "solid-js";
import type { ComponentProps } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type ProgressRootProps = Omit<
	ComponentProps<typeof ProgressPrimitiveRoot>,
	"class"
> & {
	class?: string;
	indeterminate?: boolean;
	minValue?: number;
	maxValue?: number;
};

const Progress: Component<ProgressRootProps> = (props) => {
	const rest = omit(
		props,
		"children",
		"class",
		"indeterminate",
		"minValue",
		"maxValue",
		"value",
		"min",
		"max",
	);
	return (
		<ProgressPrimitiveRoot
			min={props.min ?? props.minValue}
			max={props.max ?? props.maxValue}
			value={props.indeterminate ? null : props.value}
			class={cn(
				"relative h-4 w-full overflow-hidden rounded-full bg-secondary",
				props.class,
			)}
			{...rest}
		>
			{props.children}
			<ProgressPrimitiveTrack class="h-full w-full flex-1 bg-secondary transition-all">
				<ProgressPrimitiveFill class="h-full w-(--progress-value) bg-primary transition-all duration-500 ease-in-out motion-reduce:transition-none" />
			</ProgressPrimitiveTrack>
		</ProgressPrimitiveRoot>
	);
};

const ProgressLabel: Component<
	ComponentProps<typeof ProgressPrimitiveLabel>
> = (props) => <ProgressPrimitiveLabel {...props} />;

const ProgressValueLabel: Component<
	ComponentProps<typeof ProgressPrimitiveValueLabel>
> = (props) => <ProgressPrimitiveValueLabel {...props} />;

export { Progress, ProgressLabel, ProgressValueLabel };
