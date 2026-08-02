import type { Component, JSX } from "solid-js";
import { splitProps } from "solid-js";

type IconProps = JSX.SvgSVGAttributes<SVGSVGElement> & {
	size?: number | string;
};

function icon(draw: () => JSX.Element): Component<IconProps> {
	return (props) => {
		const [local, rest] = splitProps(props, ["size"]);
		return (
			<svg
				{...rest}
				aria-hidden="true"
				fill="none"
				height={local.size ?? 24}
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				viewBox="0 0 24 24"
				width={local.size ?? 24}
				xmlns="http://www.w3.org/2000/svg"
			>
				{draw()}
			</svg>
		);
	};
}

// Inline Lucide geometry keeps SVGs visible without leaking lucide-solid's
// CommonJS defaults into TanStack Start route modules (`template` regression).
export const ArrowLeft = icon(() => (
	<>
		<path d="m12 19-7-7 7-7" />
		<path d="M19 12H5" />
	</>
));
export const BriefcaseBusiness = icon(() => (
	<>
		<path d="M12 12h.01" />
		<path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
		<path d="M22 13a18.15 18.15 0 0 1-20 0" />
		<rect height="14" rx="2" width="20" x="2" y="6" />
	</>
));
export const Binary = icon(() => (
	<>
		<rect height="8" rx="2" width="8" x="3" y="3" />
		<path d="M7 7h.01M14 3h1v8m-1 0h2M3 14h1v7m-1 0h2" />
		<rect height="8" rx="2" width="8" x="13" y="13" />
		<path d="M17 17h.01" />
	</>
));
export const Bot = icon(() => (
	<>
		<rect height="12" rx="2" width="18" x="3" y="8" />
		<path d="M12 4v4M8 12h.01M16 12h.01M9 16h6M1 13h2M21 13h2" />
	</>
));
export const ChevronDown = icon(() => <path d="m6 9 6 6 6-6" />);
export const ChevronLeft = icon(() => <path d="m15 18-6-6 6-6" />);
export const ChevronRight = icon(() => <path d="m9 18 6-6-6-6" />);
export const CircleHelp = icon(() => (
	<>
		<circle cx="12" cy="12" r="10" />
		<path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4" />
		<path d="M12 18h.01" />
	</>
));
export const Clock3 = icon(() => (
	<>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 6v6h4" />
	</>
));
export const Database = icon(() => (
	<>
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M3 5v14a9 3 0 0 0 18 0V5" />
		<path d="M3 12a9 3 0 0 0 18 0" />
	</>
));
export const Ellipsis = icon(() => (
	<>
		<circle cx="5" cy="12" r="1" />
		<circle cx="12" cy="12" r="1" />
		<circle cx="19" cy="12" r="1" />
	</>
));
export const FileText = icon(() => (
	<>
		<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z" />
		<path d="M14 2v5a1 1 0 0 0 1 1h5M8 13h8M8 17h8" />
	</>
));
export const Image = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
	</>
));
export const Library = icon(() => (
	<>
		<path d="M4 4v16M8 8v12M12 6v14m4-14 4 14" />
	</>
));
export const Menu = icon(() => <path d="M4 5h16M4 12h16M4 19h16" />);
export const PanelLeftClose = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M9 3v18m7-6-3-3 3-3" />
	</>
));
export const PanelLeftOpen = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M9 3v18m5-12 3 3-3 3" />
	</>
));
export const Plus = icon(() => <path d="M5 12h14M12 5v14" />);
export const RefreshCw = icon(() => (
	<>
		<path d="M3 12a9 9 0 0 1 15.7-6.3L21 8" />
		<path d="M21 3v5h-5M21 12a9 9 0 0 1-15.7 6.3L3 16" />
		<path d="M8 16H3v5" />
	</>
));
export const Scan = icon(() => (
	<>
		<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
		<circle cx="12" cy="12" r="3" />
	</>
));
export const ScanSearch = icon(() => (
	<>
		<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2" />
		<circle cx="14" cy="14" r="3" />
		<path d="m21 21-4.9-4.9" />
	</>
));
export const Search = icon(() => (
	<>
		<path d="m21 21-4.34-4.34" />
		<circle cx="11" cy="11" r="8" />
	</>
));
export const Settings = icon(() => (
	<>
		<path d="M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.03 2.34 2.34 0 0 0 0 3.84 2.34 2.34 0 0 1-2.33 4.03 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.03 2.34 2.34 0 0 0 0-3.84 2.34 2.34 0 0 1 2.33-4.03 2.34 2.34 0 0 0 3.32-1.91" />
		<circle cx="12" cy="12" r="3" />
	</>
));
export const Sparkles = icon(() => (
	<>
		<path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5zM5 17l-.75 2.25L2 20l2.25.75L5 23l.75-2.25L8 20l-2.25-.75zM19 15l-.75 2.25L16 18l2.25.75L19 21l.75-2.25L22 18l-2.25-.75z" />
	</>
));
