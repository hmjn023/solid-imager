
import type { ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { Progress as ProgressPrimitive } from "@kobalte/core";

import { cn } from "~/presentation/utils/cn";

const Progress = (props: ComponentProps<typeof ProgressPrimitive.Root>) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <ProgressPrimitive.Root
      class={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        local.class
      )}
      {...others}
    >
      <ProgressPrimitive.Fill
        class="h-full w-full flex-1 bg-primary transition-all"
        style={{
          transform: `translateX(-${
            100 - (others.value || 0)
          }%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
};

export { Progress };
