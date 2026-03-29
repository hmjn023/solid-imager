import {
	Fill as ProgressPrimitiveFill,
	Label as ProgressPrimitiveLabel,
	Root as ProgressPrimitiveRoot,
	Track as ProgressPrimitiveTrack,
	ValueLabel as ProgressPrimitiveValueLabel,
} from "@kobalte/core/progress";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "./utils/cn";

const ProgressRoot: Component<ComponentProps<typeof ProgressPrimitiveRoot>> = (
	props,
) => {
	const [, rest] = splitProps(props, ["children", "class"]);
	return (
		<ProgressPrimitiveRoot
			class={cn(
				"relative h-4 w-full overflow-hidden rounded-full bg-secondary",
				props.class,
			)}
			{...rest}
		>
			{props.children}
		</ProgressPrimitiveRoot>
	);
};

const ProgressLabel: Component<
	ComponentProps<typeof ProgressPrimitiveLabel>
> = (props) => <ProgressPrimitiveLabel {...props} />;

const ProgressValueLabel: Component<
	ComponentProps<typeof ProgressPrimitiveValueLabel>
> = (props) => <ProgressPrimitiveValueLabel {...props} />;

const Progress: Component<ComponentProps<typeof ProgressPrimitiveRoot>> = (
	props,
) => (
	<ProgressRoot {...props}>
		<ProgressPrimitiveTrack class="h-full w-full flex-1 bg-secondary transition-all">
			<ProgressPrimitiveFill class="h-full w-full flex-1 bg-primary transition-all duration-500 ease-in-out data-[progress=complete]:bg-primary" />
		</ProgressPrimitiveTrack>
	</ProgressRoot>
);

export { Progress, ProgressLabel, ProgressValueLabel };
