import type { JSX, ParentProps } from "solid-js";

interface AppShellProps {
	nav: JSX.Element;
	statusIndicator?: JSX.Element;
}

export function AppShell(props: ParentProps<AppShellProps>) {
	return (
		<div class="flex min-h-screen flex-col bg-background text-foreground">
			{props.statusIndicator}
			{props.nav}
			<main class="flex-1">{props.children}</main>
		</div>
	);
}
