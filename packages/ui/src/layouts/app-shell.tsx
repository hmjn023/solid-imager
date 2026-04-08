import type { JSX } from "solid-js";

interface AppShellProps {
	nav: JSX.Element;
	children: JSX.Element;
}

export function AppShell(props: AppShellProps) {
	return (
		<div class="flex min-h-screen flex-col bg-background text-foreground">
			{props.nav}
			<div class="flex-1">{props.children}</div>
		</div>
	);
}
