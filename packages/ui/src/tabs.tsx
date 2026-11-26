import type { PolymorphicProps } from "./utils/polymorphic";
import {
	TabsPanel as TabsContentPrimitive,
	TabsList as TabsListPrimitive,
	Tabs as TabsRoot,
	TabsTab as TabsTriggerPrimitive,
} from "@ui-sdk/solid/tabs";
import type { ComponentProps, ValidComponent } from "@solidjs/web";
import { omit } from "solid-js";

import { cn } from "./utils/cn";

type TabsProps = Omit<
	ComponentProps<typeof TabsRoot<string>>,
	"onChange" | "onValueChange" | "activation"
> & {
	onChange?: (value: string) => void;
	activationMode?: "automatic" | "manual";
};
const Tabs = (props: TabsProps) => (
	<TabsRoot
		{...omit(props, "onChange", "activationMode")}
		activation={props.activationMode}
		onValueChange={(value) => {
			if (value !== null) props.onChange?.(value);
		}}
	/>
);

type TabsListProps = Omit<ComponentProps<typeof TabsListPrimitive>, "class"> & {
	class?: string | undefined;
};

const TabsList = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsListProps>,
) => {
	const others = omit(props as TabsListProps, "class");
	return (
		<TabsListPrimitive
			class={cn(
				"inline-flex min-h-10 max-w-full items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
				props.class,
			)}
			{...others}
		/>
	);
};

type TabsTriggerProps = Omit<
	ComponentProps<typeof TabsTriggerPrimitive>,
	"class"
> & {
	class?: string | undefined;
};

const TabsTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, TabsTriggerProps>,
) => {
	const others = omit(props as TabsTriggerProps, "class");
	return (
		<TabsTriggerPrimitive
			class={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm",
				props.class,
			)}
			{...others}
		/>
	);
};

type TabsContentProps = Omit<
	ComponentProps<typeof TabsContentPrimitive>,
	"class" | "aria-hidden"
> & {
	forceMount?: boolean;
	"aria-hidden"?:
		| ComponentProps<typeof TabsContentPrimitive>["aria-hidden"]
		| boolean;
	class?: string | undefined;
};

const TabsContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsContentProps>,
) => {
	const others = omit(
		props as TabsContentProps,
		"class",
		"forceMount",
		"aria-hidden",
	);
	return (
		<TabsContentPrimitive
			keepMounted={props.forceMount}
			aria-hidden={
				typeof props["aria-hidden"] === "boolean"
					? props["aria-hidden"]
						? "true"
						: "false"
					: props["aria-hidden"]
			}
			class={cn(
				"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				props.class,
			)}
			{...others}
		/>
	);
};

export { Tabs, TabsContent, TabsList, TabsTrigger };
