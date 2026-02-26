import type { PolymorphicProps } from "@kobalte/core";
import {
	Content as TabsContentPrimitive,
	type TabsContentProps as TabsContentPropsPrimitive,
	List as TabsListPrimitive,
	type TabsListProps as TabsListPropsPrimitive,
	Root as TabsRoot,
	Trigger as TabsTriggerPrimitive,
	type TabsTriggerProps as TabsTriggerPropsPrimitive,
} from "@kobalte/core/tabs";
import type { ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "~/presentation/utils/cn";

const Tabs = TabsRoot;

type TabsListProps = TabsListPropsPrimitive & {
	class?: string | undefined;
};

const TabsList = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsListProps>,
) => {
	const [local, others] = splitProps(props as TabsListProps, ["class"]);
	return (
		<TabsListPrimitive
			class={cn(
				"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
				local.class,
			)}
			{...others}
		/>
	);
};

type TabsTriggerProps = TabsTriggerPropsPrimitive & {
	class?: string | undefined;
};

const TabsTrigger = <T extends ValidComponent = "button">(
	props: PolymorphicProps<T, TabsTriggerProps>,
) => {
	const [local, others] = splitProps(props as TabsTriggerProps, ["class"]);
	return (
		<TabsTriggerPrimitive
			class={cn(
				"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-background data-[selected]:text-foreground data-[selected]:shadow-sm",
				local.class,
			)}
			{...others}
		/>
	);
};

type TabsContentProps = TabsContentPropsPrimitive & {
	class?: string | undefined;
};

const TabsContent = <T extends ValidComponent = "div">(
	props: PolymorphicProps<T, TabsContentProps>,
) => {
	const [local, others] = splitProps(props as TabsContentProps, ["class"]);
	return (
		<TabsContentPrimitive
			class={cn(
				"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				local.class,
			)}
			{...others}
		/>
	);
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
