// Adapted from the Solid UI v2 table registry recipe.
import type { ComponentProps } from "@solidjs/web";

import { cn } from "./utils/cn";

type TableProps = ComponentProps<"table">;

const Table = (props: TableProps) => (
	<div class="relative w-full overflow-auto" data-slot="table-container">
		<table
			data-slot="table"
			{...props}
			class={cn("w-full caption-bottom text-sm", props.class)}
		/>
	</div>
);

const TableHeader = (props: ComponentProps<"thead">) => (
	<thead
		data-slot="table-header"
		{...props}
		class={cn("[&_tr]:border-b", props.class)}
	/>
);

const TableBody = (props: ComponentProps<"tbody">) => (
	<tbody
		data-slot="table-body"
		{...props}
		class={cn("[&_tr:last-child]:border-0", props.class)}
	/>
);

const TableFooter = (props: ComponentProps<"tfoot">) => (
	<tfoot
		data-slot="table-footer"
		{...props}
		class={cn(
			"bg-primary font-medium text-primary-foreground [&>tr]:last:border-b-0",
			props.class,
		)}
	/>
);

const TableRow = (props: ComponentProps<"tr">) => (
	<tr
		data-slot="table-row"
		{...props}
		class={cn(
			"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
			props.class,
		)}
	/>
);

const TableHead = (props: ComponentProps<"th">) => (
	<th
		data-slot="table-head"
		{...props}
		class={cn(
			"h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
			props.class,
		)}
	/>
);

const TableCell = (props: ComponentProps<"td">) => (
	<td
		data-slot="table-cell"
		{...props}
		class={cn("p-2 align-middle [&:has([role=checkbox])]:pr-0", props.class)}
	/>
);

const TableCaption = (props: ComponentProps<"caption">) => (
	<caption
		data-slot="table-caption"
		{...props}
		class={cn("mt-4 text-sm text-muted-foreground", props.class)}
	/>
);

export {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
};
