import type { ParentProps } from "solid-js";
import { createEffect, createSignal } from "solid-js";
import { Tooltip } from "../tooltip";

export function SidebarTooltip(props: ParentProps<{ disabled: boolean }>) {
	const [open, setOpen] = createSignal(false);
	createEffect(() => {
		if (props.disabled) setOpen(false);
	});

	return (
		<Tooltip
			disabled={props.disabled}
			onOpenChange={(next) => setOpen(next && !props.disabled)}
			open={open() && !props.disabled}
			placement="right"
		>
			{props.children}
		</Tooltip>
	);
}
