import type { JSX, ParentProps } from "solid-js";

interface AppShellProps {
	nav: JSX.Element;
	statusIndicator?: JSX.Element;
}

export function AppShell(props: ParentProps<AppShellProps>) {
	return (
		<div class="flex min-h-screen min-h-[100dvh] flex-col bg-background pb-[env(safe-area-inset-bottom)] text-foreground">
			{props.statusIndicator}
			{props.nav}
			<div class="flex-1" id="main-content" tabIndex={-1}>
				{props.children}
			</div>
		</div>
	);
}
