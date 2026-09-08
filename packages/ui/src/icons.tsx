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
export const ArrowDownUp = icon(() => (
	<>
		<path d="m3 16 4 4 4-4" />
		<path d="M7 20V4" />
		<path d="m21 8-4-4-4 4" />
		<path d="M17 4v16" />
	</>
));
export const Ban = icon(() => (
	<>
		<circle cx="12" cy="12" r="10" />
		<path d="m4.929 4.929 14.142 14.142" />
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
export const CircleAlert = icon(() => (
	<>
		<circle cx="12" cy="12" r="10" />
		<line x1="12" x2="12" y1="8" y2="12" />
		<line x1="12" x2="12.01" y1="16" y2="16" />
	</>
));
export const CircleCheck = icon(() => (
	<>
		<circle cx="12" cy="12" r="10" />
		<path d="m16 9-5.5 5.5L8 12" />
	</>
));
export const CopyCheck = icon(() => (
	<>
		<path d="m12 15 2 2 4-4" />
		<rect height="14" rx="2" width="14" x="8" y="8" />
		<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
	</>
));
export const Database = icon(() => (
	<>
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M3 5v14a9 3 0 0 0 18 0V5" />
		<path d="M3 12a9 3 0 0 0 18 0" />
	</>
));
export const Download = icon(() => (
	<>
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
		<path d="m7 10 5 5 5-5M12 15V3" />
	</>
));
export const DownloadCloud = icon(() => (
	<>
		<path d="M12 13v8l-4-4" />
		<path d="m12 21 4-4" />
		<path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
	</>
));
export const Ellipsis = icon(() => (
	<>
		<circle cx="5" cy="12" r="1" />
		<circle cx="12" cy="12" r="1" />
		<circle cx="19" cy="12" r="1" />
	</>
));
export const ExternalLink = icon(() => (
	<>
		<path d="M15 3h6v6" />
		<path d="m10 14 11-11" />
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
	</>
));
export const Filter = icon(() => (
	<path d="M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z" />
));
export const FileText = icon(() => (
	<>
		<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z" />
		<path d="M14 2v5a1 1 0 0 0 1 1h5M8 13h8M8 17h8" />
	</>
));
export const Folder = icon(() => (
	<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
));
export const Grid3X3 = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
	</>
));
export const HardDrive = icon(() => (
	<>
		<path d="M10 16h.01" />
		<path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
		<path d="M21.946 12.013H2.054" />
		<path d="M6 16h.01" />
	</>
));
export const Image = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
	</>
));
export const Inbox = icon(() => (
	<>
		<polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
		<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
	</>
));
export const Keyboard = icon(() => (
	<>
		<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01" />
		<rect height="16" rx="2" width="20" x="2" y="4" />
	</>
));
export const Library = icon(() => (
	<>
		<path d="M4 4v16M8 8v12M12 6v14m4-14 4 14" />
	</>
));
export const List = icon(() => (
	<>
		<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13" />
	</>
));
export const Logs = icon(() => (
	<>
		<path d="M3 5h1M3 12h1M3 19h1M8 5h1M8 12h1M8 19h1M13 5h8M13 12h8M13 19h8" />
	</>
));
export const Menu = icon(() => <path d="M4 5h16M4 12h16M4 19h16" />);
export const Maximize2 = icon(() => (
	<>
		<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
	</>
));
export const Minus = icon(() => <path d="M5 12h14" />);
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
export const PanelsTopLeft = icon(() => (
	<>
		<rect height="18" rx="2" width="18" x="3" y="3" />
		<path d="M3 9h18M9 21V9" />
	</>
));
export const Pencil = icon(() => (
	<>
		<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
		<path d="m15 5 4 4" />
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
export const RotateCcw = icon(() => (
	<>
		<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
		<path d="M3 3v5h5" />
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
export const Share2 = icon(() => (
	<>
		<circle cx="18" cy="5" r="3" />
		<circle cx="6" cy="12" r="3" />
		<circle cx="18" cy="19" r="3" />
		<line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
		<line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
	</>
));
export const Trash2 = icon(() => (
	<>
		<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
		<path d="M10 11v6M14 11v6" />
	</>
));
export const Upload = icon(() => (
	<>
		<path d="M12 3v12" />
		<path d="m17 8-5-5-5 5" />
		<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
	</>
));
export const X = icon(() => (
	<>
		<path d="M18 6 6 18" />
		<path d="m6 6 12 12" />
	</>
));
