import ArrowDownUp from "lucide-solid/icons/arrow-down-up";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import Ban from "lucide-solid/icons/ban";
import Bot from "lucide-solid/icons/bot";
import BriefcaseBusiness from "lucide-solid/icons/briefcase-business";
import ChevronDown from "lucide-solid/icons/chevron-down";
import ChevronLeft from "lucide-solid/icons/chevron-left";
import ChevronRight from "lucide-solid/icons/chevron-right";
import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import Clock3 from "lucide-solid/icons/clock-3";
import DownloadCloud from "lucide-solid/icons/cloud-download";
import Database from "lucide-solid/icons/database";
import Download from "lucide-solid/icons/download";
import ExternalLink from "lucide-solid/icons/external-link";
import Filter from "lucide-solid/icons/filter";
import Folder from "lucide-solid/icons/folder";
import Grid3X3 from "lucide-solid/icons/grid-3-x-3";
import HardDrive from "lucide-solid/icons/hard-drive";
import Image from "lucide-solid/icons/image";
import Inbox from "lucide-solid/icons/inbox";
import Library from "lucide-solid/icons/library";
import List from "lucide-solid/icons/list";
import Logs from "lucide-solid/icons/logs";
import PanelLeftClose from "lucide-solid/icons/panel-left-close";
import PanelLeftOpen from "lucide-solid/icons/panel-left-open";
import PanelsTopLeft from "lucide-solid/icons/panels-top-left";
import Plus from "lucide-solid/icons/plus";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import Search from "lucide-solid/icons/search";
import Settings from "lucide-solid/icons/settings";
import Share2 from "lucide-solid/icons/share-2";
import Trash2 from "lucide-solid/icons/trash-2";
import X from "lucide-solid/icons/x";
import {
	createEffect,
	createMemo,
	createSignal,
	For,
	type JSX,
	onCleanup,
	Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../alert-dialog";
import { Badge } from "../badge";
import { Button, buttonVariants } from "../button";
import {
	CollapsibleContent,
	CollapsibleRoot,
	CollapsibleTrigger,
} from "../collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "../dialog";
import { Input } from "../input";
import { Label } from "../label";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Progress } from "../progress";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "../switch";
import { toast } from "../toast";

type MockMedia = {
	id: string;
	name: string;
	extension: "JPG" | "PNG";
	src: string;
	resolution: string;
	size: string;
	tags: string[];
};

type DesignFilterState = {
	searchQuery: string;
	selectedIps: string[];
	selectedCharacters: string[];
	selectedTags: string[];
	excludeTags: string[];
	selectedAuthors: string[];
	selectedProjects: string[];
};

type FilterArrayKey = Exclude<keyof DesignFilterState, "searchQuery">;

type FilterToken = {
	id: string;
	key: keyof DesignFilterState;
	prefix: string;
	value: string;
	destructive?: boolean;
};

type DesignLabView =
	| "detail"
	| "interactions"
	| "jobs"
	| "layouts"
	| "library"
	| "manager"
	| "overlays"
	| "settings";

type MockSource = {
	count: number;
	id: string;
	name: string;
	status: "online" | "syncing";
	type: string;
};

type MockJob = {
	completed: number;
	error?: string;
	id: string;
	name: string;
	source: string;
	started: string;
	status: "completed" | "failed" | "queued" | "running";
	total: number;
	type: string;
};

type ManagerArea =
	| "characters"
	| "duplicates"
	| "ips"
	| "projects"
	| "tagging"
	| "transfer"
	| "vectors";

type MockManagerEntity = {
	description: string;
	id: string;
	mediaCount: number;
	modified: string;
	name: string;
	relations: string[];
};

type SettingsCategory =
	| "ai"
	| "downloads"
	| "jobs"
	| "logging"
	| "media"
	| "storage";

type SettingsDraft = {
	aiTimeout: string;
	aiUrl: string;
	generalConcurrency: string;
	aiConcurrency: string;
	imageExtensions: string;
	logLevel: string;
	requestInterval: string;
	thumbnailDirectory: string;
	thumbnailQuality: string;
	thumbnailSize: string;
	videoExtensions: string;
};

type ScreenLayoutKind = "collection" | "detail" | "management" | "settings";

type DrawerDraft = {
	description: string;
	tags: string;
	characters: string;
	ips: string;
	projects: string;
};

type DrawerFieldKey = Exclude<keyof DrawerDraft, "description">;

const EMPTY_DRAWER_DRAFT: DrawerDraft = {
	description: "",
	tags: "",
	characters: "",
	ips: "",
	projects: "",
};

const MOCK_SOURCES: MockSource[] = [
	{
		count: 864,
		id: "local-assets",
		name: "Local assets",
		status: "online",
		type: "Local",
	},
	{
		count: 312,
		id: "production-s3",
		name: "Production S3",
		status: "online",
		type: "S3",
	},
	{
		count: 72,
		id: "reference-sftp",
		name: "References",
		status: "syncing",
		type: "SFTP",
	},
];

const MOCK_JOBS: MockJob[] = [
	{
		completed: 184,
		id: "job-batch-tags",
		name: "Extract tags",
		source: "Local assets",
		started: "2 min ago",
		status: "running",
		total: 240,
		type: "AI batch",
	},
	{
		completed: 38,
		id: "job-sync-s3",
		name: "Sync source",
		source: "Production S3",
		started: "Just now",
		status: "running",
		total: 112,
		type: "Source sync",
	},
	{
		completed: 0,
		id: "job-vectors",
		name: "Extract CCIP vectors",
		source: "References",
		started: "Queued 1 min ago",
		status: "queued",
		total: 72,
		type: "AI batch",
	},
	{
		completed: 61,
		error: "AI service stopped responding after 30 seconds.",
		id: "job-crop",
		name: "Detect characters",
		source: "Local assets",
		started: "12 min ago",
		status: "failed",
		total: 96,
		type: "AI batch",
	},
	{
		completed: 312,
		id: "job-import",
		name: "Import metadata",
		source: "Production S3",
		started: "Today, 10:42",
		status: "completed",
		total: 312,
		type: "Import",
	},
];

const MANAGER_AREAS: Array<{
	description: string;
	group: "Entities" | "Tools";
	label: string;
	value: ManagerArea;
}> = [
	{
		description: "制作単位と用途",
		group: "Entities",
		label: "Projects",
		value: "projects",
	},
	{
		description: "作品・シリーズ",
		group: "Entities",
		label: "IPs",
		value: "ips",
	},
	{
		description: "人物と所属IP",
		group: "Entities",
		label: "Characters",
		value: "characters",
	},
	{
		description: "AIタグを一括付与",
		group: "Tools",
		label: "Batch tagging",
		value: "tagging",
	},
	{
		description: "CCIP特徴量を生成",
		group: "Tools",
		label: "Vector extraction",
		value: "vectors",
	},
	{
		description: "重複候補を整理",
		group: "Tools",
		label: "Duplicates",
		value: "duplicates",
	},
	{
		description: "書き出しと復元",
		group: "Tools",
		label: "Data transfer",
		value: "transfer",
	},
];

const MOCK_MANAGER_ENTITIES: Record<
	"characters" | "ips" | "projects",
	MockManagerEntity[]
> = {
	projects: [
		{
			description: "夏季キャンペーン向けのキービジュアルと資料",
			id: "project-summer",
			mediaCount: 184,
			modified: "2 min ago",
			name: "Summer Visuals",
			relations: ["学園アイドルマスター", "花海咲季"],
		},
		{
			description: "商品ページ用の切り抜き・物撮り素材",
			id: "project-catalog",
			mediaCount: 96,
			modified: "Yesterday",
			name: "Product Catalog",
			relations: ["Production S3"],
		},
		{
			description: "背景と構図のリファレンス集",
			id: "project-reference",
			mediaCount: 312,
			modified: "Jul 28",
			name: "Reference Board",
			relations: ["References", "scenery"],
		},
		{
			description: "公開前のキャラクター案と差分",
			id: "project-character",
			mediaCount: 72,
			modified: "Jul 24",
			name: "Character Studies",
			relations: ["Local assets"],
		},
	],
	ips: [
		{
			description: "学園を舞台にしたアイドルプロジェクト",
			id: "ip-gakumas",
			mediaCount: 428,
			modified: "Today",
			name: "学園アイドルマスター",
			relations: ["花海咲季", "月村手毬", "藤田ことね"],
		},
		{
			description: "アイドルマスターシリーズ共通分類",
			id: "ip-idolmaster",
			mediaCount: 684,
			modified: "Jul 26",
			name: "THE IDOLM@STER",
			relations: ["5 Characters"],
		},
	],
	characters: [
		{
			description: "初星学園 普通科1年",
			id: "character-saki",
			mediaCount: 108,
			modified: "Today",
			name: "花海咲季",
			relations: ["学園アイドルマスター"],
		},
		{
			description: "初星学園 普通科1年",
			id: "character-temari",
			mediaCount: 92,
			modified: "Yesterday",
			name: "月村手毬",
			relations: ["学園アイドルマスター"],
		},
		{
			description: "初星学園 普通科1年",
			id: "character-kotone",
			mediaCount: 86,
			modified: "Jul 27",
			name: "藤田ことね",
			relations: ["学園アイドルマスター"],
		},
	],
};

const INITIAL_SETTINGS_DRAFT: SettingsDraft = {
	aiConcurrency: "2",
	aiTimeout: "30000",
	aiUrl: "http://ai-worker.local:3000",
	generalConcurrency: "4",
	imageExtensions: ".jpg, .jpeg, .png, .webp, .gif",
	logLevel: "Info",
	requestInterval: "1200",
	thumbnailDirectory: "./data/thumbnails",
	thumbnailQuality: "82",
	thumbnailSize: "480",
	videoExtensions: ".mp4, .webm, .mov",
};

const DRAWER_FIELDS: Array<{ key: DrawerFieldKey; label: string }> = [
	{ key: "tags", label: "Tags" },
	{ key: "characters", label: "Characters" },
	{ key: "ips", label: "IPs" },
	{ key: "projects", label: "Projects" },
];

const FILTER_FIELDS: Array<{
	key: FilterArrayKey;
	label: string;
	placeholder: string;
	prefix: string;
	primary: boolean;
}> = [
	{
		key: "selectedTags",
		label: "タグ（すべて含む）",
		placeholder: "scenery, summer",
		prefix: "tag",
		primary: true,
	},
	{
		key: "excludeTags",
		label: "除外タグ",
		placeholder: "R18, spoiler",
		prefix: "-tag",
		primary: true,
	},
	{
		key: "selectedCharacters",
		label: "キャラクター",
		placeholder: "花海咲季",
		prefix: "character",
		primary: true,
	},
	{
		key: "selectedIps",
		label: "IP",
		placeholder: "学園アイドルマスター",
		prefix: "ip",
		primary: false,
	},
	{
		key: "selectedAuthors",
		label: "作者",
		placeholder: "作者名・ID",
		prefix: "author",
		primary: false,
	},
	{
		key: "selectedProjects",
		label: "プロジェクト",
		placeholder: "Summer Visuals",
		prefix: "project",
		primary: false,
	},
];

const MOCK_MEDIA: MockMedia[] = [
	{
		id: "field",
		name: "scenery_field_summer.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-field/960/720",
		resolution: "3840 × 2160",
		size: "4.2 MB",
		tags: ["scenery", "summer", "sky", "field"],
	},
	{
		id: "night",
		name: "city_after_rain.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-night/720/720",
		resolution: "2048 × 2048",
		size: "3.8 MB",
		tags: ["city", "night", "rain"],
	},
	{
		id: "coast",
		name: "coastal_drive.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-coast/960/720",
		resolution: "4096 × 3072",
		size: "5.1 MB",
		tags: ["coast", "travel", "vehicle"],
	},
	{
		id: "objects",
		name: "soft_shapes.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-objects/720/720",
		resolution: "2048 × 2048",
		size: "2.7 MB",
		tags: ["objects", "pastel", "reference"],
	},
	{
		id: "mountain",
		name: "alpine_lake.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-mountain/960/720",
		resolution: "5120 × 2880",
		size: "6.4 MB",
		tags: ["mountain", "lake", "nature"],
	},
	{
		id: "portrait",
		name: "portrait_study.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-portrait/720/720",
		resolution: "2400 × 2400",
		size: "3.2 MB",
		tags: ["portrait", "study", "warm"],
	},
	{
		id: "machine",
		name: "machine_companion.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-machine/720/720",
		resolution: "2048 × 2048",
		size: "3.0 MB",
		tags: ["machine", "character", "concept"],
	},
	{
		id: "interior",
		name: "quiet_interior.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-interior/960/720",
		resolution: "4200 × 2800",
		size: "5.8 MB",
		tags: ["interior", "light", "architecture"],
	},
	{
		id: "food",
		name: "late_lunch.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-food/720/720",
		resolution: "3000 × 3000",
		size: "4.0 MB",
		tags: ["food", "reference", "warm"],
	},
	{
		id: "illustration",
		name: "character_profile.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-illustration/720/720",
		resolution: "2048 × 2048",
		size: "2.9 MB",
		tags: ["character", "profile", "illustration"],
	},
	{
		id: "space",
		name: "deep_space.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-space/960/720",
		resolution: "3840 × 2160",
		size: "4.7 MB",
		tags: ["space", "dark", "concept"],
	},
	{
		id: "chair",
		name: "chair_catalog.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-chair/720/720",
		resolution: "1800 × 1800",
		size: "2.1 MB",
		tags: ["product", "chair", "catalog"],
	},
	{
		id: "texture",
		name: "painted_texture.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-texture/720/720",
		resolution: "3200 × 3200",
		size: "6.1 MB",
		tags: ["texture", "paint", "reference"],
	},
	{
		id: "bicycle",
		name: "green_bicycle.jpg",
		extension: "JPG",
		src: "https://picsum.photos/seed/solid-bicycle/960/720",
		resolution: "3600 × 2400",
		size: "4.4 MB",
		tags: ["bicycle", "green", "object"],
	},
	{
		id: "architecture",
		name: "white_facade.png",
		extension: "PNG",
		src: "https://picsum.photos/seed/solid-building/720/720",
		resolution: "2160 × 2160",
		size: "3.6 MB",
		tags: ["architecture", "minimal", "white"],
	},
];

function SidebarItem(props: {
	active?: boolean;
	badge?: string;
	children: JSX.Element;
	expanded: boolean;
	label: string;
	onClick?: () => void;
}) {
	return (
		<Button
			aria-current={props.active ? "page" : undefined}
			aria-label={props.badge ? `${props.label}, ${props.badge}` : props.label}
			class={`relative h-10 w-full justify-start px-3 text-[#505754] hover:bg-[#e9eeeb] hover:text-[#1d2522] ${
				props.active ? "bg-[#e1f1ed] text-[#05695f]" : ""
			}`}
			onClick={props.onClick}
			title={props.expanded ? undefined : props.label}
			variant="ghost"
		>
			<span class="shrink-0">{props.children}</span>
			<Show when={!props.expanded && props.badge}>
				<span class="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-[#0b8f80] font-semibold text-[9px] text-white ring-2 ring-[#f6f7f5]">
					{props.badge}
				</span>
			</Show>
			<Show when={props.expanded}>
				<span class="hidden min-w-0 flex-1 truncate xl:block">
					{props.label}
				</span>
				<Show when={props.badge}>
					<span class="hidden min-w-5 items-center justify-center rounded-full bg-[#dceae6] px-1.5 font-semibold text-[#086f64] text-[10px] xl:flex">
						{props.badge}
					</span>
				</Show>
			</Show>
		</Button>
	);
}

function DesignSourcesNavigation(props: {
	expanded: boolean;
	onExpandedChange: (expanded: boolean) => void;
	onSelect: (sourceId: string) => void;
	selectedId: string;
}) {
	const [open, setOpen] = createSignal(true);

	return (
		<CollapsibleRoot.Root class="min-h-0" onOpenChange={setOpen} open={open()}>
			<CollapsibleTrigger
				aria-label="Sources"
				class="flex h-10 w-full items-center gap-2 rounded-md px-3 text-left font-medium text-[#505754] text-sm outline-none hover:bg-[#e9eeeb] hover:text-[#1d2522] focus-visible:ring-2 focus-visible:ring-[#08766a]"
				onClick={() => {
					if (!props.expanded) props.onExpandedChange(true);
				}}
			>
				<Database aria-hidden="true" class="shrink-0" size={18} />
				<Show when={props.expanded}>
					<span class="hidden min-w-0 flex-1 truncate xl:block">Sources</span>
					<ChevronDown
						aria-hidden="true"
						class={`hidden shrink-0 transition-transform motion-reduce:transition-none xl:block ${
							open() ? "rotate-180" : ""
						}`}
						size={14}
					/>
				</Show>
			</CollapsibleTrigger>
			<CollapsibleContent class="hidden min-h-0 xl:block">
				<div class="ml-4 max-h-[min(34dvh,18rem)] overflow-y-auto overscroll-contain border-[#dce2de] border-l py-1 pl-2">
					<button
						aria-pressed={props.selectedId === "all"}
						class={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] ${
							props.selectedId === "all"
								? "bg-[#e1f1ed] font-medium text-[#05695f]"
								: "text-[#555d59] hover:bg-[#e9eeeb]"
						}`}
						onClick={() => props.onSelect("all")}
						type="button"
					>
						<span class="min-w-0 flex-1 truncate">All media</span>
						<span class="text-[#626a66] text-[10px]">1,248</span>
					</button>
					<For each={MOCK_SOURCES}>
						{(source) => (
							<button
								aria-pressed={props.selectedId === source.id}
								class={`group/source min-h-11 w-full rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] ${
									props.selectedId === source.id
										? "bg-[#e1f1ed] text-[#05695f]"
										: "text-[#555d59] hover:bg-[#e9eeeb]"
								}`}
								onClick={() => props.onSelect(source.id)}
								type="button"
							>
								<span class="flex min-w-0 items-center gap-2">
									<span
										aria-hidden="true"
										class={`size-1.5 shrink-0 rounded-full ${
											source.status === "online"
												? "bg-[#20a276]"
												: "animate-pulse bg-[#d99431] motion-reduce:animate-none"
										}`}
									/>
									<span class="sr-only">
										{source.status === "online" ? "接続中" : "同期中"}
									</span>
									<span class="min-w-0 flex-1 truncate font-medium">
										{source.name}
									</span>
									<span class="text-[#626a66] text-[10px]">{source.count}</span>
								</span>
								<span class="mt-0.5 block pl-3.5 text-[#626a66] text-[10px]">
									{source.type}
									{source.status === "syncing" ? " · Syncing" : ""}
								</span>
							</button>
						)}
					</For>
				</div>
				<div class="mt-1 grid grid-cols-[1fr_auto] gap-1 px-2 pl-6">
					<Button
						class="h-8 justify-start px-2 text-xs"
						size="sm"
						variant="ghost"
					>
						<Plus aria-hidden="true" size={14} />
						Add source
					</Button>
					<Button
						aria-label="すべてのソースを同期"
						class="size-8 p-0 text-[#626a66]"
						size="icon"
						variant="ghost"
					>
						<RefreshCw aria-hidden="true" size={14} />
					</Button>
				</div>
			</CollapsibleContent>
		</CollapsibleRoot.Root>
	);
}

function DesignSidebar(props: {
	activeView: DesignLabView;
	expanded: boolean;
	inboxCount: number;
	onExpandedChange: (expanded: boolean) => void;
	onInboxOpen: () => void;
	onSourceChange: (sourceId: string) => void;
	onViewChange: (view: DesignLabView) => void;
	selectedSourceId: string;
}) {
	return (
		<aside
			aria-label="アプリケーションサイドバー"
			class="flex min-h-0 flex-col border-[#e1e5e2] border-r bg-[#f6f7f5] p-2"
		>
			<div class="group mb-5 flex h-12 items-center gap-2 px-2">
				<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0b8f80] text-white">
					<Image aria-hidden="true" size={17} />
				</div>
				<Show when={props.expanded}>
					<strong class="min-w-0 flex-1 truncate font-semibold text-[#17201d] text-base">
						Solid Imager
					</strong>
				</Show>
				<Button
					aria-label={
						props.expanded ? "サイドバーを折りたたむ" : "サイドバーを展開する"
					}
					class={`size-8 shrink-0 p-0 text-[#6d7471] hover:bg-[#e4e8e5] ${
						props.expanded
							? "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
							: "opacity-100"
					}`}
					onClick={() => props.onExpandedChange(!props.expanded)}
					size="icon"
					title={props.expanded ? "折りたたむ" : "展開する"}
					variant="ghost"
				>
					<Show fallback={<PanelLeftOpen size={17} />} when={props.expanded}>
						<PanelLeftClose size={17} />
					</Show>
				</Button>
			</div>

			<nav aria-label="デザイン案ナビゲーション" class="space-y-1">
				<SidebarItem
					active={props.activeView === "library"}
					expanded={props.expanded}
					label="Library"
					onClick={() => props.onViewChange("library")}
				>
					<Library aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "detail"}
					expanded={props.expanded}
					label="Media Detail"
					onClick={() => props.onViewChange("detail")}
				>
					<Image aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "overlays"}
					expanded={props.expanded}
					label="UI Patterns"
					onClick={() => props.onViewChange("overlays")}
				>
					<PanelsTopLeft aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "layouts"}
					expanded={props.expanded}
					label="Screen Layouts"
					onClick={() => props.onViewChange("layouts")}
				>
					<Grid3X3 aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "interactions"}
					expanded={props.expanded}
					label="Interactions"
					onClick={() => props.onViewChange("interactions")}
				>
					<ArrowDownUp aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem expanded={props.expanded} label="Search">
					<Search aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					badge={props.inboxCount > 0 ? String(props.inboxCount) : undefined}
					expanded={props.expanded}
					label="Import inbox"
					onClick={props.onInboxOpen}
				>
					<Inbox aria-hidden="true" size={18} />
				</SidebarItem>
				<DesignSourcesNavigation
					expanded={props.expanded}
					onExpandedChange={props.onExpandedChange}
					onSelect={(sourceId) => {
						props.onSourceChange(sourceId);
						props.onViewChange("library");
					}}
					selectedId={props.selectedSourceId}
				/>
				<SidebarItem
					active={props.activeView === "manager"}
					expanded={props.expanded}
					label="Manager"
					onClick={() => props.onViewChange("manager")}
				>
					<BriefcaseBusiness aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "jobs"}
					badge="2"
					expanded={props.expanded}
					label="Jobs"
					onClick={() => props.onViewChange("jobs")}
				>
					<Clock3 aria-hidden="true" size={18} />
				</SidebarItem>
				<SidebarItem
					active={props.activeView === "settings"}
					expanded={props.expanded}
					label="Settings"
					onClick={() => props.onViewChange("settings")}
				>
					<Settings aria-hidden="true" size={18} />
				</SidebarItem>
			</nav>
		</aside>
	);
}

function MediaTile(props: {
	media: MockMedia;
	onSelect: () => void;
	selected: boolean;
}) {
	return (
		<button
			aria-label={`${props.media.name}を選択`}
			aria-pressed={props.selected}
			class={`group relative aspect-[4/3] min-w-0 overflow-hidden rounded-md bg-[#e7eae7] text-left outline-none ring-offset-2 ring-offset-[#fafbf9] transition focus-visible:ring-2 focus-visible:ring-[#0b8f80] ${
				props.selected
					? "ring-2 ring-[#0b8f80]"
					: "hover:ring-1 hover:ring-[#aeb7b2]"
			}`}
			onClick={props.onSelect}
			type="button"
		>
			<img
				alt=""
				class="size-full object-cover transition duration-200 group-hover:scale-[1.015]"
				loading="lazy"
				referrerpolicy="no-referrer"
				src={props.media.src}
			/>
			<div class="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/50 to-transparent px-2 pt-8 pb-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
				<span class="truncate pr-2 font-medium text-[11px] text-white">
					{props.media.name}
				</span>
				<span class="rounded bg-black/65 px-1.5 py-0.5 font-medium text-[10px] text-white">
					{props.media.extension}
				</span>
			</div>
			<Show when={props.selected}>
				<span class="absolute top-2 left-2 flex size-6 items-center justify-center rounded-full bg-[#0b8f80] font-bold text-white text-xs shadow-sm">
					✓
				</span>
			</Show>
		</button>
	);
}

type SearchMode = "simple" | "pro";

function parseFilterValues(value: string) {
	return [
		...new Set(
			value
				.split(",")
				.map((part) => part.trim())
				.filter(Boolean),
		),
	];
}

function DesignFilterField(props: {
	field: (typeof FILTER_FIELDS)[number];
	state: DesignFilterState;
	onChange: (key: FilterArrayKey, values: string[]) => void;
}) {
	const inputId = () => `design-filter-${props.field.key}`;
	const [draft, setDraft] = createSignal(
		props.state[props.field.key].join(", "),
	);
	let inputElement: HTMLInputElement | undefined;

	createEffect(() => {
		const canonicalValue = props.state[props.field.key].join(", ");
		if (!inputElement?.matches(":focus")) setDraft(canonicalValue);
	});

	return (
		<div class="space-y-1.5 sm:space-y-1">
			<Label class="font-medium text-[#454c49] text-xs" for={inputId()}>
				{props.field.label}
			</Label>
			<Input
				class="h-9 min-h-9 border-[#d9dfdb] bg-white shadow-none focus-visible:ring-[#0b8f80]"
				id={inputId()}
				name={inputId()}
				onBlur={() => setDraft(props.state[props.field.key].join(", "))}
				onInput={(event) => {
					const value = event.currentTarget.value;
					setDraft(value);
					props.onChange(props.field.key, parseFilterValues(value));
				}}
				placeholder={props.field.placeholder}
				ref={(element) => {
					inputElement = element;
				}}
				value={draft()}
			/>
		</div>
	);
}

function DesignFilterPopover(props: {
	filterCount: number;
	mode: SearchMode;
	onClear: () => void;
	onModeChange: (mode: SearchMode) => void;
	onValuesChange: (key: FilterArrayKey, values: string[]) => void;
	state: DesignFilterState;
}) {
	return (
		<Popover placement="bottom-end">
			<PopoverTrigger
				aria-label={`検索フィルター、${props.filterCount}件の条件`}
				class={buttonVariants({
					class:
						"h-9 border-[#d9dfdb] bg-white px-3 text-[#434a47] shadow-none",
					size: "sm",
					variant: "outline",
				})}
			>
				<Filter aria-hidden="true" size={15} />
				フィルター
				<Show when={props.filterCount > 0}>
					<span class="flex min-w-5 items-center justify-center rounded-full bg-[#05695f] px-1.5 py-0.5 text-[10px] text-white">
						{props.filterCount}
					</span>
				</Show>
			</PopoverTrigger>
			<PopoverContent class="w-[min(24rem,calc(100dvw-2rem))] border-[#dfe4e1] bg-[#fbfcfa] p-0 shadow-xl">
				<div class="flex items-start justify-between border-[#e1e5e2] border-b px-4 py-3">
					<div>
						<h2 class="font-semibold text-[#202624] text-sm">検索フィルター</h2>
						<p class="mt-0.5 text-[#7a817d] text-[11px]">
							検索バーと同じ条件を編集します
						</p>
					</div>
					<Button
						class="h-7 px-2 text-[#6e7571] text-xs"
						onClick={props.onClear}
						size="sm"
						variant="ghost"
					>
						すべて解除
					</Button>
				</div>

				<div class="p-4">
					<fieldset>
						<legend class="mb-2 font-medium text-[#555c58] text-xs">
							検索モード
						</legend>
						<div class="grid grid-cols-2 rounded-md border border-[#d9dfdb] bg-white p-0.5">
							<For
								each={
									[
										["simple", "簡易"],
										["pro", "詳細"],
									] as const
								}
							>
								{([value, label]) => (
									<Button
										aria-pressed={props.mode === value}
										class={`h-8 px-2 ${
											props.mode === value
												? "bg-[#e1f1ed] text-[#087d70] hover:bg-[#d8ebe6]"
												: "text-[#656c68]"
										}`}
										onClick={() => props.onModeChange(value)}
										size="sm"
										variant="ghost"
									>
										{label}
									</Button>
								)}
							</For>
						</div>
					</fieldset>

					<Show
						fallback={
							<div class="mt-4 rounded-md border border-[#dfe4e1] bg-white p-4 text-[#6d7470] text-xs leading-5">
								{props.mode === "pro"
									? "詳細検索は条件ビルダーを別パネルで開き、この一覧レイアウトは維持します。"
									: "検索条件をここで確認し、一覧の並べ替えは維持します。"}
							</div>
						}
						when={props.mode === "simple"}
					>
						<div class="mt-4 space-y-4">
							<div class="space-y-3">
								<h3 class="font-medium text-[#555c58] text-xs">よく使う条件</h3>
								<div class="space-y-3">
									<For each={FILTER_FIELDS.filter((field) => field.primary)}>
										{(field) => (
											<DesignFilterField
												field={field}
												onChange={props.onValuesChange}
												state={props.state}
											/>
										)}
									</For>
								</div>
							</div>

							<div class="border-[#e3e7e4] border-t pt-4">
								<h3 class="mb-3 font-medium text-[#555c58] text-xs">
									追加条件
								</h3>
								<div class="space-y-3">
									<For each={FILTER_FIELDS.filter((field) => !field.primary)}>
										{(field) => (
											<DesignFilterField
												field={field}
												onChange={props.onValuesChange}
												state={props.state}
											/>
										)}
									</For>
								</div>
							</div>
						</div>
					</Show>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function DesignToolbar(props: {
	draft: string;
	filterTokens: FilterToken[];
	filters: DesignFilterState;
	mode: SearchMode;
	onClearFilters: () => void;
	onDraftChange: (value: string) => void;
	onDraftSubmit: () => void;
	onModeChange: (mode: SearchMode) => void;
	onRemoveToken: (token: FilterToken) => void;
	onValuesChange: (key: FilterArrayKey, values: string[]) => void;
	sourceName: string;
}) {
	return (
		<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-4 py-3">
			<div class="mb-3 flex h-7 items-center gap-2 text-sm">
				<span class="text-[#5f6763]">Library</span>
				<span class="text-[#adb3af]">/</span>
				<strong class="min-w-0 truncate font-semibold text-[#222826]">
					{props.sourceName}
				</strong>
			</div>
			<div class="flex min-w-0 flex-wrap items-start gap-2">
				<form
					autocomplete="off"
					class="relative min-w-64 flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						props.onDraftSubmit();
					}}
				>
					<Label class="sr-only" for="design-search-input">
						メディアを検索
					</Label>
					<Search
						aria-hidden="true"
						class="absolute top-[1.1rem] left-3 text-[#7b827e]"
						size={17}
					/>
					<div class="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-[#d9dfdb] bg-white py-1 pr-9 pl-9 shadow-none focus-within:ring-2 focus-within:ring-[#0b8f80] focus-within:ring-offset-1">
						<For each={props.filterTokens.slice(0, 4)}>
							{(token) => (
								<span
									class={`inline-flex h-6 max-w-52 items-center gap-1 rounded px-1.5 font-medium text-[11px] ${
										token.destructive
											? "bg-[#fbeceb] text-[#a1453d]"
											: "bg-[#e8f2ef] text-[#267268]"
									}`}
								>
									<span class="truncate">
										{token.prefix}:{token.value}
									</span>
									<button
										aria-label={`${token.prefix}:${token.value}を解除`}
										class="flex size-4 shrink-0 items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b8f80]"
										onClick={() => props.onRemoveToken(token)}
										type="button"
									>
										<X aria-hidden="true" size={11} />
									</button>
								</span>
							)}
						</For>
						<Show when={props.filterTokens.length > 4}>
							<span class="inline-flex h-6 items-center rounded bg-[#eef0ee] px-2 font-medium text-[#686f6b] text-[11px]">
								ほか{props.filterTokens.length - 4}件
							</span>
						</Show>
						<Input
							class="h-7 min-h-7 min-w-44 flex-1 border-0 bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
							autocomplete="off"
							enterkeyhint="search"
							id="design-search-input"
							onInput={(event) =>
								props.onDraftChange(event.currentTarget.value)
							}
							placeholder="検索、または tag: / author: / ip: …"
							value={props.draft}
						/>
					</div>
					<kbd class="absolute top-2 right-2 rounded border border-[#e1e5e2] bg-[#f4f5f3] px-1.5 py-0.5 text-[#858c88] text-[10px]">
						/
					</kbd>
				</form>
				<DesignFilterPopover
					filterCount={props.filterTokens.length}
					mode={props.mode}
					onClear={props.onClearFilters}
					onModeChange={props.onModeChange}
					onValuesChange={props.onValuesChange}
					state={props.filters}
				/>
				<Button
					class="h-9 border-[#dde2df] bg-white px-3 shadow-none"
					size="sm"
					variant="outline"
				>
					<ArrowDownUp aria-hidden="true" size={15} />
					作成日・降順
					<ChevronDown aria-hidden="true" size={13} />
				</Button>
				<div class="flex rounded-md border border-[#dde2df] bg-white p-0.5">
					<Button
						aria-label="グリッド表示"
						class="size-8 bg-[#0b8f80] p-0 text-white hover:bg-[#087c70]"
						size="icon"
					>
						<Grid3X3 aria-hidden="true" size={15} />
					</Button>
					<Button
						aria-label="リスト表示"
						class="size-8 p-0 text-[#707773]"
						size="icon"
						variant="ghost"
					>
						<List aria-hidden="true" size={15} />
					</Button>
				</div>
			</div>
		</header>
	);
}

function InspectorAction(props: {
	children: JSX.Element;
	destructive?: boolean;
	icon: JSX.Element;
}) {
	return (
		<Button
			class={`h-8 w-full justify-start px-1 font-normal ${props.destructive ? "text-red-600 hover:text-red-700" : "text-[#505754]"}`}
			size="sm"
			variant="ghost"
		>
			{props.icon}
			{props.children}
		</Button>
	);
}

function DesignInspector(props: {
	media: MockMedia;
	onOpenDetail: () => void;
}) {
	return (
		<aside
			aria-label="メディア情報"
			class="min-h-0 overflow-y-auto overscroll-contain border-[#e1e5e2] border-l bg-[#fbfcfa]"
		>
			<div class="sticky top-0 z-10 flex h-12 items-center border-[#e1e5e2] border-b bg-[#fbfcfa]/95 px-4 backdrop-blur-sm">
				<h2 class="flex-1 font-semibold text-[#303633] text-sm">
					選択中のメディア
				</h2>
				<Button
					aria-label="インスペクターを閉じる"
					class="size-8 p-0 text-[#6e7571]"
					size="icon"
					variant="ghost"
				>
					<X aria-hidden="true" size={15} />
				</Button>
			</div>

			<div class="p-4">
				<img
					alt={props.media.name}
					class="aspect-[4/3] w-full rounded-md bg-[#e7eae7] object-contain"
					referrerpolicy="no-referrer"
					src={props.media.src}
				/>
				<div class="border-[#e1e5e2] border-b py-4">
					<h1 class="break-words font-semibold text-[#202624] text-sm">
						{props.media.name}
					</h1>
					<p class="mt-1 text-[#5f6763] text-xs">
						{props.media.extension} ・ {props.media.size} ・{" "}
						{props.media.resolution}
					</p>
				</div>

				<dl class="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2.5 border-[#e1e5e2] border-b py-4 text-xs">
					<dt class="text-[#626a66]">Source</dt>
					<dd class="flex min-w-0 items-center gap-2 text-[#444b48]">
						<Folder aria-hidden="true" size={14} />
						<span class="truncate">File System / Assets</span>
					</dd>
					<dt class="text-[#626a66]">Created</dt>
					<dd class="text-[#444b48]">May 10, 2026</dd>
				</dl>

				<section class="border-[#e1e5e2] border-b py-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="font-medium text-[#505754] text-xs">Tags</h2>
						<Button
							aria-label="タグを追加"
							class="size-7 p-0"
							size="icon"
							variant="ghost"
						>
							<Plus aria-hidden="true" size={14} />
						</Button>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<For each={props.media.tags}>
							{(tag) => (
								<Badge
									class="border-0 bg-[#eef0ee] px-2 py-1 font-normal text-[#555c58]"
									variant="secondary"
								>
									{tag}
								</Badge>
							)}
						</For>
					</div>
				</section>

				<section class="border-[#e1e5e2] border-b py-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="font-medium text-[#505754] text-xs">Relations</h2>
						<Button
							aria-label="関連付けを編集"
							class="size-7 p-0"
							size="icon"
							variant="ghost"
						>
							<Plus aria-hidden="true" size={14} />
						</Button>
					</div>
					<div class="space-y-2 text-xs">
						<div class="flex items-center justify-between gap-3">
							<span class="text-[#626a66]">Character</span>
							<Badge
								class="border-0 bg-[#eef0ee] font-normal"
								variant="secondary"
							>
								Hanami Ume
							</Badge>
						</div>
						<div class="flex items-center justify-between gap-3">
							<span class="text-[#626a66]">Project</span>
							<Badge
								class="border-0 bg-[#eef0ee] font-normal"
								variant="secondary"
							>
								Summer Visuals
							</Badge>
						</div>
					</div>
				</section>

				<section class="py-4">
					<Button
						class="mb-3 h-9 w-full bg-[#0b8f80] hover:bg-[#087c70]"
						onClick={props.onOpenDetail}
						size="sm"
					>
						<ExternalLink aria-hidden="true" size={14} />
						個別画面を開く
					</Button>
					<details class="group">
						<summary class="flex min-h-9 cursor-pointer list-none items-center justify-between rounded-md px-2 font-medium text-[#606763] text-xs hover:bg-[#eef1ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b8f80]">
							その他の操作
							<ChevronDown
								aria-hidden="true"
								class="transition-transform group-open:rotate-180 motion-reduce:transition-none"
								size={14}
							/>
						</summary>
						<div class="mt-1">
							<InspectorAction icon={<Download aria-hidden="true" size={14} />}>
								Download
							</InspectorAction>
							<InspectorAction icon={<Share2 aria-hidden="true" size={14} />}>
								Share
							</InspectorAction>
							<InspectorAction icon={<Folder aria-hidden="true" size={14} />}>
								Move to…
							</InspectorAction>
							<InspectorAction
								destructive
								icon={<Trash2 aria-hidden="true" size={14} />}
							>
								Delete
							</InspectorAction>
						</div>
					</details>
				</section>
			</div>
		</aside>
	);
}

function DetailMetadataSection(props: {
	children: JSX.Element;
	onAdd?: () => void;
	title: string;
}) {
	return (
		<section class="border-[#e1e5e2] border-b py-4">
			<div class="mb-2 flex items-center justify-between gap-3">
				<h2 class="font-medium text-[#39413d] text-sm">{props.title}</h2>
				<Show when={props.onAdd}>
					<Button
						aria-label={`${props.title}を編集`}
						class="size-8 p-0"
						onClick={props.onAdd}
						size="icon"
						variant="ghost"
					>
						<Plus aria-hidden="true" size={14} />
					</Button>
				</Show>
			</div>
			{props.children}
		</section>
	);
}

function DesignMediaDetailScreen(props: {
	media: MockMedia;
	onBack: () => void;
	onNext: () => void;
	onPrevious: () => void;
}) {
	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-white">
			<header class="z-10 border-[#e1e5e2] border-b bg-[#fbfcfa] px-3 py-2 sm:px-4">
				<div class="flex min-w-0 items-center gap-2">
					<Button
						aria-label="一覧に戻る"
						class="size-9 shrink-0 p-0"
						onClick={props.onBack}
						size="icon"
						variant="ghost"
					>
						<ArrowLeft aria-hidden="true" size={17} />
					</Button>
					<div class="min-w-0 flex-1">
						<h1 class="truncate font-semibold text-[#29312d] text-sm">
							{props.media.name}
						</h1>
						<p class="truncate text-[#626a66] text-[11px]">
							File System / Assets
						</p>
					</div>

					<div class="flex shrink-0 items-center rounded-md border border-[#dce2de] bg-white p-0.5">
						<Button
							aria-label="前のメディア"
							class="size-8 p-0"
							onClick={props.onPrevious}
							size="icon"
							variant="ghost"
						>
							<ChevronLeft aria-hidden="true" size={16} />
						</Button>
						<Button
							aria-label="次のメディア"
							class="size-8 p-0"
							onClick={props.onNext}
							size="icon"
							variant="ghost"
						>
							<ChevronRight aria-hidden="true" size={16} />
						</Button>
					</div>

					<div class="hidden shrink-0 items-center gap-2 md:flex">
						<Button class="h-9" size="sm">
							<Bot aria-hidden="true" size={15} />
							Extract tags
						</Button>
						<Button class="h-9" size="sm" variant="outline">
							<Search aria-hidden="true" size={15} />
							Find similar
						</Button>
						<details class="group relative">
							<summary
								class={`${buttonVariants({ size: "sm", variant: "outline" })} h-9 cursor-pointer list-none`}
							>
								More actions
								<ChevronDown
									aria-hidden="true"
									class="transition-transform group-open:rotate-180 motion-reduce:transition-none"
									size={14}
								/>
							</summary>
							<div class="absolute top-11 right-0 z-20 w-56 rounded-md border border-[#dce2de] bg-white p-1 shadow-lg">
								<InspectorAction icon={<Bot aria-hidden="true" size={14} />}>
									Extract tags (OppaiOracle)
								</InspectorAction>
								<InspectorAction icon={<Image aria-hidden="true" size={14} />}>
									Detect & crop characters
								</InspectorAction>
								<InspectorAction icon={<Share2 aria-hidden="true" size={14} />}>
									Re-extract CCIP vector
								</InspectorAction>
								<InspectorAction
									icon={<Download aria-hidden="true" size={14} />}
								>
									Download original
								</InspectorAction>
							</div>
						</details>
					</div>
				</div>

				<div class="mt-2 grid grid-cols-2 gap-2 md:hidden">
					<Button class="h-10" size="sm">
						<Bot aria-hidden="true" size={15} />
						Extract tags
					</Button>
					<Button class="h-10" size="sm" variant="outline">
						<Search aria-hidden="true" size={15} />
						Find similar
					</Button>
				</div>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:overflow-hidden">
				<figure class="flex min-w-0 items-center justify-center bg-white lg:min-h-0">
					<img
						alt={props.media.name}
						class="block h-auto w-full object-contain lg:h-full lg:w-full"
						fetchpriority="high"
						height="720"
						referrerpolicy="no-referrer"
						src={props.media.src}
						width="960"
					/>
					<figcaption class="sr-only">
						{props.media.name} のプレビュー
					</figcaption>
				</figure>

				<aside
					aria-label="メディア詳細"
					class="border-[#e1e5e2] border-t bg-[#fbfcfa] px-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-t-0 lg:border-l [scrollbar-gutter:stable]"
				>
					<div class="border-[#e1e5e2] border-b py-4">
						<h2 class="break-words font-semibold text-[#252c28] text-base">
							{props.media.name}
						</h2>
						<p class="mt-1 text-[#59615d] text-xs">
							{props.media.extension} · {props.media.size} ·{" "}
							{props.media.resolution}
						</p>
					</div>

					<DetailMetadataSection title="Description">
						<div class="flex items-start justify-between gap-3">
							<p class="text-[#626a66] text-xs italic leading-5">
								No description
							</p>
							<Button class="h-7 px-2 text-xs" variant="ghost">
								Edit
							</Button>
						</div>
					</DetailMetadataSection>

					<DetailMetadataSection onAdd={() => undefined} title="Relations">
						<dl class="space-y-3 text-xs">
							<div class="flex items-start justify-between gap-3">
								<dt class="text-[#626a66]">Project</dt>
								<dd>
									<Badge variant="secondary">Summer Visuals</Badge>
								</dd>
							</div>
							<div class="flex items-start justify-between gap-3">
								<dt class="text-[#626a66]">IP</dt>
								<dd>
									<Badge variant="secondary">学園アイドルマスター</Badge>
								</dd>
							</div>
							<div class="flex items-start justify-between gap-3">
								<dt class="text-[#626a66]">Character</dt>
								<dd>
									<Badge variant="secondary">花海咲季</Badge>
								</dd>
							</div>
						</dl>
					</DetailMetadataSection>

					<DetailMetadataSection onAdd={() => undefined} title="Positive tags">
						<div class="flex flex-wrap gap-1.5">
							<For each={props.media.tags}>
								{(tag) => <Badge variant="secondary">{tag}</Badge>}
							</For>
							<Badge variant="secondary">high quality</Badge>
							<Badge variant="secondary">detailed</Badge>
						</div>
					</DetailMetadataSection>

					<DetailMetadataSection title="File information">
						<dl class="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2 text-xs">
							<dt class="text-[#626a66]">Source</dt>
							<dd class="truncate text-[#3e4743]">Local assets</dd>
							<dt class="text-[#626a66]">Created</dt>
							<dd class="text-[#3e4743]">May 10, 2026</dd>
							<dt class="text-[#626a66]">Modified</dt>
							<dd class="text-[#3e4743]">Today, 14:32</dd>
						</dl>
					</DetailMetadataSection>

					<details class="group py-3 md:hidden">
						<summary class="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md px-2 font-medium text-[#4f5753] text-sm outline-none hover:bg-[#edf1ef] focus-visible:ring-2 focus-visible:ring-[#08766a]">
							More actions
							<ChevronDown
								aria-hidden="true"
								class="transition-transform group-open:rotate-180"
								size={15}
							/>
						</summary>
						<div class="mt-1">
							<InspectorAction icon={<Image aria-hidden="true" size={14} />}>
								Detect & crop characters
							</InspectorAction>
							<InspectorAction icon={<Share2 aria-hidden="true" size={14} />}>
								Re-extract CCIP vector
							</InspectorAction>
							<InspectorAction icon={<Download aria-hidden="true" size={14} />}>
								Download original
							</InspectorAction>
						</div>
					</details>
				</aside>
			</div>
		</section>
	);
}

const MOCK_IMPORT_POSTS = [
	{
		author: "@visual_archive",
		id: "import-field",
		media: MOCK_MEDIA[0],
		source: "X / Twitter",
	},
	{
		author: "@night_reference",
		id: "import-night",
		media: MOCK_MEDIA[1],
		source: "X / Twitter",
	},
	{
		author: "coastal-sketch",
		id: "import-coast",
		media: MOCK_MEDIA[2],
		source: "Pixiv",
	},
	{
		author: "product-notes",
		id: "import-objects",
		media: MOCK_MEDIA[3],
		source: "Web page",
	},
];

function ImportInboxDialog(props: {
	onOpenChange: (open: boolean) => void;
	open: boolean;
}) {
	const allIds = () => new Set(MOCK_IMPORT_POSTS.map((post) => post.id));
	const [selectedIds, setSelectedIds] = createSignal(allIds());

	createEffect(() => {
		if (props.open) setSelectedIds(allIds());
	});

	const togglePost = (id: string) => {
		const next = new Set(selectedIds());
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setSelectedIds(next);
	};
	const allSelected = () => selectedIds().size === MOCK_IMPORT_POSTS.length;

	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
			<DialogContent class="grid max-w-5xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
				<DialogHeader class="border-[#e1e5e2] border-b px-5 py-4 pr-12 sm:px-6 sm:py-5 sm:pr-12">
					<DialogTitle>Import inbox</DialogTitle>
					<DialogDescription>
						ブラウザ拡張から届いた投稿を確認し、取り込むメディアを選択します。
					</DialogDescription>
				</DialogHeader>

				<div class="flex flex-col gap-3 border-[#e1e5e2] border-b bg-[#f8faf8] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
					<div class="flex items-center gap-2">
						<span class="text-[#59615d] text-xs">Import to</span>
						<Button
							class="h-9 min-w-44 justify-between bg-white"
							variant="outline"
						>
							Local assets
							<ChevronDown aria-hidden="true" size={14} />
						</Button>
					</div>
					<div class="flex items-center justify-between gap-3 sm:justify-end">
						<p class="text-[#59615d] text-xs">
							{selectedIds().size} of {MOCK_IMPORT_POSTS.length} selected
						</p>
						<Button
							aria-pressed={allSelected()}
							class="h-8 px-2 text-xs"
							onClick={() =>
								setSelectedIds(allSelected() ? new Set<string>() : allIds())
							}
							variant="ghost"
						>
							{allSelected() ? "Clear all" : "Select all"}
						</Button>
					</div>
				</div>

				<div class="overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 [scrollbar-gutter:stable]">
					<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						<For each={MOCK_IMPORT_POSTS}>
							{(post) => (
								<li>
									<button
										aria-pressed={selectedIds().has(post.id)}
										class={`group relative w-full overflow-hidden rounded-md border bg-white text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] focus-visible:ring-offset-2 ${
											selectedIds().has(post.id)
												? "border-[#0b8f80] ring-1 ring-[#0b8f80]"
												: "border-[#dce2de] hover:border-[#aeb8b2]"
										}`}
										onClick={() => togglePost(post.id)}
										type="button"
									>
										<div class="relative aspect-square overflow-hidden bg-[#edf0ed]">
											<img
												alt=""
												class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
												height="320"
												loading="lazy"
												referrerpolicy="no-referrer"
												src={post.media.src}
												width="320"
											/>
											<span
												class={`absolute top-2 right-2 flex size-6 items-center justify-center rounded-full border shadow-sm ${
													selectedIds().has(post.id)
														? "border-[#0b8f80] bg-[#0b8f80] text-white"
														: "border-white/80 bg-white/90 text-transparent"
												}`}
											>
												<CircleCheck aria-hidden="true" size={15} />
											</span>
										</div>
										<div class="p-3">
											<strong class="block truncate font-medium text-[#303935] text-sm">
												{post.author}
											</strong>
											<span class="mt-0.5 block truncate text-[#59615d] text-xs">
												{post.source} · {post.media.name}
											</span>
										</div>
									</button>
								</li>
							)}
						</For>
					</ul>
				</div>

				<DialogFooter class="border-[#e1e5e2] border-t px-5 py-4 sm:px-6">
					<Button
						class="mr-auto text-[#a13f38]"
						disabled={selectedIds().size === 0}
						variant="ghost"
					>
						<Trash2 aria-hidden="true" size={15} />
						Delete selected
					</Button>
					<Button onClick={() => props.onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={selectedIds().size === 0}
						onClick={() => props.onOpenChange(false)}
					>
						Import {selectedIds().size > 0 ? selectedIds().size : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function PatternCard(props: {
	children: JSX.Element;
	description: string;
	label: string;
	title: string;
}) {
	return (
		<article class="flex min-h-64 flex-col rounded-lg border border-[#dde3df] bg-white p-5 shadow-[0_1px_2px_rgba(25,35,31,0.04)]">
			<div class="mb-5">
				<Badge
					class="mb-3 border-0 bg-[#edf1ef] font-medium text-[#59615d] text-[10px]"
					variant="secondary"
				>
					{props.label}
				</Badge>
				<h2 class="font-semibold text-[#252b28] text-base">{props.title}</h2>
				<p class="mt-2 text-[#626a66] text-xs leading-5">{props.description}</p>
			</div>
			<div class="mt-auto">{props.children}</div>
		</article>
	);
}

const SCREEN_LAYOUT_OPTIONS: Array<{
	description: string;
	label: string;
	value: ScreenLayoutKind;
}> = [
	{
		description: "検索・選択・比較",
		label: "Collection",
		value: "collection",
	},
	{ description: "単体を大きく見る", label: "Detail", value: "detail" },
	{
		description: "行単位で管理する",
		label: "Management",
		value: "management",
	},
	{ description: "設定を順に編集する", label: "Settings", value: "settings" },
];

const PREVIEW_ITEMS = Array.from({ length: 12 }, (_, index) => index);
const PREVIEW_ROWS = Array.from({ length: 6 }, (_, index) => index);

function CollectionLayoutPreview() {
	return (
		<div class="flex size-full min-h-0 flex-col" aria-hidden="true">
			<div class="flex h-14 shrink-0 items-center gap-3 border-[#dfe4e1] border-b px-4">
				<div class="h-8 min-w-0 flex-1 rounded-md border border-[#d7ddda] bg-white" />
				<div class="h-8 w-24 rounded-md bg-[#08766a]" />
			</div>
			<div class="flex h-10 shrink-0 items-center justify-between border-[#e6e9e7] border-b px-4">
				<div class="h-2.5 w-20 rounded-full bg-[#aeb7b2]" />
				<div class="flex gap-2">
					<div class="size-6 rounded bg-[#dfe5e1]" />
					<div class="size-6 rounded bg-[#edf0ee]" />
				</div>
			</div>
			<div class="grid min-h-0 flex-1 grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_clamp(20rem,26vw,26rem)]">
				<div class="grid min-h-0 grid-cols-3 content-start gap-2 overflow-hidden p-3 sm:grid-cols-4">
					<For each={PREVIEW_ITEMS}>
						{(index) => (
							<div
								class={`aspect-[4/3] rounded ${
									index === 0
										? "bg-[#9bcfc6] ring-2 ring-[#08766a]"
										: "bg-[#dfe5e1]"
								}`}
							/>
						)}
					</For>
				</div>
				<div class="hidden border-[#dfe4e1] border-l bg-white p-4 2xl:block">
					<div class="aspect-[4/3] w-full rounded bg-[#d5ded9]" />
					<div class="mt-4 h-3 w-4/5 rounded-full bg-[#87948e]" />
					<div class="mt-2 h-2 w-3/5 rounded-full bg-[#d2d8d5]" />
					<div class="mt-5 space-y-2">
						<div class="h-7 rounded bg-[#edf1ef]" />
						<div class="h-7 rounded bg-[#edf1ef]" />
					</div>
				</div>
			</div>
		</div>
	);
}

function DetailLayoutPreview() {
	return (
		<div class="flex size-full min-h-0 flex-col" aria-hidden="true">
			<div class="flex h-14 shrink-0 items-center justify-between border-[#dfe4e1] border-b px-4">
				<div class="flex items-center gap-3">
					<div class="size-7 rounded bg-[#e5e9e7]" />
					<div class="h-3 w-36 rounded-full bg-[#8c9892]" />
				</div>
				<div class="h-8 w-20 rounded-md border border-[#d7ddda] bg-white" />
			</div>
			<div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_15rem]">
				<div class="flex min-h-72 items-center justify-center bg-[#f2f4f2] p-6">
					<div class="aspect-[4/3] max-h-full w-full max-w-xl rounded-sm bg-[#b9d8d2] shadow-sm" />
				</div>
				<div class="hidden overflow-hidden border-[#dfe4e1] border-l bg-white p-4 lg:block">
					<div class="h-3 w-4/5 rounded-full bg-[#87948e]" />
					<div class="mt-2 h-2 w-2/5 rounded-full bg-[#d2d8d5]" />
					<div class="mt-5 grid gap-2">
						<div class="h-8 rounded bg-[#08766a]" />
						<div class="h-8 rounded border border-[#dce1de]" />
					</div>
					<div class="mt-6 space-y-3 border-[#e3e7e4] border-t pt-4">
						<For each={PREVIEW_ROWS.slice(0, 4)}>
							{() => <div class="h-7 rounded bg-[#edf1ef]" />}
						</For>
					</div>
				</div>
			</div>
		</div>
	);
}

function ManagementLayoutPreview() {
	return (
		<div class="flex size-full min-h-0 flex-col" aria-hidden="true">
			<div class="flex min-h-16 shrink-0 items-center justify-between gap-4 border-[#dfe4e1] border-b px-4">
				<div>
					<div class="h-3 w-28 rounded-full bg-[#7f8c86]" />
					<div class="mt-2 h-2 w-44 rounded-full bg-[#d1d7d4]" />
				</div>
				<div class="h-8 w-24 rounded-md bg-[#08766a]" />
			</div>
			<div class="flex h-11 shrink-0 items-center gap-2 border-[#e5e8e6] border-b px-4">
				<div class="h-7 w-44 rounded border border-[#d9dfdb] bg-white" />
				<div class="h-7 w-20 rounded border border-[#d9dfdb] bg-white" />
			</div>
			<div class="min-h-0 flex-1 overflow-hidden p-4">
				<div class="overflow-hidden rounded-md border border-[#dfe4e1] bg-white">
					<div class="grid h-9 grid-cols-[2fr_1fr_1fr_5rem] items-center gap-3 bg-[#f0f3f1] px-3">
						<For each={PREVIEW_ROWS.slice(0, 4)}>
							{(_, index) => (
								<div
									class={`h-2 rounded-full bg-[#adb7b2] ${index() === 0 ? "w-16" : "w-10"}`}
								/>
							)}
						</For>
					</div>
					<For each={PREVIEW_ROWS}>
						{(_, _index) => (
							<div class="grid h-12 grid-cols-[2fr_1fr_1fr_5rem] items-center gap-3 border-[#edf0ee] border-t px-3">
								<div class="flex items-center gap-2">
									<div class="size-7 rounded bg-[#d7e1dd]" />
									<div class="h-2.5 w-24 rounded-full bg-[#9ba6a1]" />
								</div>
								<div class="h-2 w-12 rounded-full bg-[#d1d7d4]" />
								<div class="h-5 w-14 rounded-full bg-[#e4f0ed]" />
								<div class="ml-auto h-6 w-8 rounded bg-[#edf0ee]" />
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
}

function SettingsLayoutPreview() {
	return (
		<div class="flex size-full min-h-0 flex-col" aria-hidden="true">
			<div class="flex min-h-16 shrink-0 items-center justify-between border-[#dfe4e1] border-b px-4">
				<div>
					<div class="h-3 w-24 rounded-full bg-[#7f8c86]" />
					<div class="mt-2 h-2 w-40 rounded-full bg-[#d1d7d4]" />
				</div>
				<div class="h-8 w-20 rounded-md bg-[#08766a]" />
			</div>
			<div class="min-h-0 flex-1 overflow-hidden px-5 py-5">
				<div class="space-y-4">
					<For each={PREVIEW_ROWS.slice(0, 3)}>
						{(_, index) => (
							<div class="rounded-md border border-[#dfe4e1] bg-white p-4">
								<div class="h-3 w-28 rounded-full bg-[#8d9993]" />
								<div class="mt-2 h-2 w-3/5 rounded-full bg-[#d2d8d5]" />
								<div class="mt-4 h-9 rounded border border-[#d9dfdb] bg-[#fbfcfb]" />
								<Show when={index() === 1}>
									<div class="mt-3 h-9 rounded border border-[#d9dfdb] bg-[#fbfcfb]" />
								</Show>
							</div>
						)}
					</For>
				</div>
			</div>
		</div>
	);
}

function ScreenLayoutsScreen() {
	const [layout, setLayout] = createSignal<ScreenLayoutKind>("collection");
	const selected = createMemo(
		() =>
			SCREEN_LAYOUT_OPTIONS.find((option) => option.value === layout()) ??
			SCREEN_LAYOUT_OPTIONS[0],
	);

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-6 py-5">
				<p class="mb-1 font-medium text-[#08766a] text-xs">
					Design lab / Screen layouts
				</p>
				<h1 class="font-semibold text-[#202624] text-xl">画面レイアウトの型</h1>
				<p class="mt-2 max-w-2xl text-[#626a66] text-sm leading-6">
					既存画面を4種類の骨格へ整理します。選択して、情報量とスクロール領域を比較できます。
				</p>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]">
				<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
					<For each={SCREEN_LAYOUT_OPTIONS}>
						{(option) => (
							<Button
								aria-pressed={layout() === option.value}
								class={`h-auto min-h-16 items-start justify-start px-4 py-3 text-left ${
									layout() === option.value
										? "border-[#87bdb4] bg-[#e8f4f1] text-[#075f56] hover:bg-[#e1f0ec]"
										: "border-[#dce2de] bg-white text-[#303734] hover:bg-[#f2f5f3]"
								}`}
								onClick={() => setLayout(option.value)}
								variant="outline"
							>
								<span>
									<span class="block font-semibold text-sm">
										{option.label}
									</span>
									<span
										class={`mt-1 block font-normal text-xs ${
											layout() === option.value
												? "text-[#356d65]"
												: "text-[#68706c]"
										}`}
									>
										{option.description}
									</span>
								</span>
							</Button>
						)}
					</For>
				</div>

				<section class="mt-4 overflow-hidden rounded-lg border border-[#dce2de] bg-[#fbfcfa] shadow-[0_1px_2px_rgba(25,35,31,0.04)]">
					<div class="flex items-center justify-between border-[#e1e5e2] border-b bg-white px-4 py-3">
						<div>
							<h2 class="font-semibold text-[#29302d] text-sm">
								{selected().label}
							</h2>
							<p class="mt-0.5 text-[#68706c] text-xs">
								{selected().description}
							</p>
						</div>
						<Badge
							class="min-w-14 whitespace-nowrap border-[#cbd7d2] bg-[#f4f7f5] text-[#50605a]"
							variant="outline"
						>
							LIVE SKELETON
						</Badge>
					</div>
					<div class="h-[min(32rem,60dvh)] min-h-96 bg-[#f8faf8]">
						<Show when={layout() === "collection"}>
							<CollectionLayoutPreview />
						</Show>
						<Show when={layout() === "detail"}>
							<DetailLayoutPreview />
						</Show>
						<Show when={layout() === "management"}>
							<ManagementLayoutPreview />
						</Show>
						<Show when={layout() === "settings"}>
							<SettingsLayoutPreview />
						</Show>
					</div>
				</section>
			</div>
		</section>
	);
}

const INTERACTION_ROWS = Array.from({ length: 18 }, (_, index) => ({
	id: `media-${index + 1}`,
	name: `media_${String(index + 1).padStart(2, "0")}.png`,
}));

function InteractionPatternsScreen() {
	const [saveState, setSaveState] = createSignal<
		"idle" | "pending" | "success"
	>("idle");
	const [pane, setPane] = createSignal<"detail" | "list">("list");
	const [selectedRow, setSelectedRow] = createSignal(INTERACTION_ROWS[3].id);
	const [scrollPosition, setScrollPosition] = createSignal(0);
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let scrollRegion: HTMLDivElement | undefined;
	let restoredScrollPosition = 0;

	onCleanup(() => {
		if (feedbackTimer !== undefined) clearTimeout(feedbackTimer);
		if (resetTimer !== undefined) clearTimeout(resetTimer);
	});

	function demonstrateSave() {
		if (saveState() === "pending") return;
		setSaveState("pending");
		feedbackTimer = setTimeout(() => {
			setSaveState("success");
			resetTimer = setTimeout(() => setSaveState("idle"), 1600);
		}, 800);
	}

	function openSelectedDetail() {
		restoredScrollPosition = scrollRegion?.scrollTop ?? 0;
		setPane("detail");
	}

	function returnToList() {
		setPane("list");
		queueMicrotask(() => {
			if (scrollRegion === undefined) return;
			scrollRegion.scrollTop = restoredScrollPosition;
			setScrollPosition(restoredScrollPosition);
		});
	}

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-6 py-5">
				<p class="mb-1 font-medium text-[#08766a] text-xs">
					Design lab / Interactions
				</p>
				<h1 class="font-semibold text-[#202624] text-xl">操作とスクロール</h1>
				<p class="mt-2 max-w-2xl text-[#626a66] text-sm leading-6">
					押した後の反応と、画面遷移後に何を保つかを共通化します。
				</p>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]">
				<div class="grid gap-4 lg:grid-cols-2">
					<section class="rounded-lg border border-[#dce2de] bg-white p-5">
						<Badge
							class="mb-3 border-0 bg-[#edf1ef] text-[#59615d] text-[10px]"
							variant="secondary"
						>
							ASYNC ACTION
						</Badge>
						<h2 class="font-semibold text-[#29302d] text-base">保存の反応</h2>
						<p class="mt-2 text-[#626a66] text-xs leading-5">
							処理中は無効化して連打を防ぎ、ボタンの外でも結果を通知します。
						</p>
						<div class="mt-6 flex items-center gap-4">
							<Button
								class="w-36 bg-[#08766a] hover:bg-[#06645a]"
								disabled={saveState() === "pending"}
								onClick={demonstrateSave}
							>
								{saveState() === "pending" ? "保存中…" : "変更を保存"}
							</Button>
							<p
								aria-live="polite"
								class={`text-xs ${
									saveState() === "success"
										? "text-[#08766a]"
										: "text-[#68706c]"
								}`}
								role="status"
							>
								{saveState() === "idle" && "待機中"}
								{saveState() === "pending" && "保存処理を実行しています"}
								{saveState() === "success" && "保存しました"}
							</p>
						</div>
					</section>

					<section class="rounded-lg border border-[#dce2de] bg-white p-5">
						<Badge
							class="mb-3 border-0 bg-[#edf1ef] text-[#59615d] text-[10px]"
							variant="secondary"
						>
							SELECTION
						</Badge>
						<h2 class="font-semibold text-[#29302d] text-base">
							選択と移動を分ける
						</h2>
						<p class="mt-2 text-[#626a66] text-xs leading-5">
							単クリックは選択だけ。詳細表示には明示されたボタンを使います。
						</p>
						<div class="mt-5 flex items-center justify-between rounded-md bg-[#f2f5f3] px-3 py-2">
							<span class="truncate text-[#4c5551] text-xs">
								{INTERACTION_ROWS.find((row) => row.id === selectedRow())?.name}
							</span>
							<Button onClick={openSelectedDetail} size="sm" variant="outline">
								詳細を開く
							</Button>
						</div>
					</section>
				</div>

				<section class="mt-4 overflow-hidden rounded-lg border border-[#dce2de] bg-white">
					<div class="flex items-center justify-between border-[#e1e5e2] border-b px-5 py-4">
						<div>
							<h2 class="font-semibold text-[#29302d] text-sm">
								スクロール位置の復元
							</h2>
							<p class="mt-1 text-[#68706c] text-xs">
								一覧をスクロールしてから詳細を開き、戻るを試せます。
							</p>
						</div>
						<Badge
							class="border-[#cbd7d2] bg-[#f4f7f5] text-[#50605a]"
							variant="outline"
						>
							{Math.round(scrollPosition())} px
						</Badge>
					</div>

					<Show
						fallback={
							<div class="flex h-80 flex-col bg-[#f7f9f7]">
								<div class="flex h-12 shrink-0 items-center gap-3 border-[#e1e5e2] border-b bg-white px-4">
									<Button onClick={returnToList} size="sm" variant="ghost">
										← 一覧へ戻る
									</Button>
									<span class="truncate font-medium text-[#38403c] text-xs">
										{
											INTERACTION_ROWS.find((row) => row.id === selectedRow())
												?.name
										}
									</span>
								</div>
								<div class="flex min-h-0 flex-1 items-center justify-center p-8">
									<div class="aspect-[4/3] h-full max-w-full rounded-md bg-[#c6ded9]" />
								</div>
							</div>
						}
						when={pane() === "list"}
					>
						<div
							class="h-80 overflow-y-auto overscroll-contain bg-[#fafbf9] [scrollbar-gutter:stable]"
							onScroll={(event) =>
								setScrollPosition(event.currentTarget.scrollTop)
							}
							ref={(element) => {
								scrollRegion = element;
							}}
						>
							<div class="sticky top-0 z-10 flex h-10 items-center justify-between border-[#e1e5e2] border-b bg-[#fbfcfa]/95 px-4 backdrop-blur-sm">
								<span class="font-medium text-[#59615d] text-xs">18 items</span>
								<span class="text-[#59615d] text-[11px]">
									この領域だけスクロール
								</span>
							</div>
							<div class="divide-y divide-[#e8ebe9]">
								<For each={INTERACTION_ROWS}>
									{(row) => (
										<button
											aria-pressed={selectedRow() === row.id}
											class={`flex h-14 w-full items-center gap-3 px-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#08766a] ${
												selectedRow() === row.id
													? "bg-[#e5f2ef]"
													: "bg-white hover:bg-[#f3f6f4]"
											}`}
											onClick={() => setSelectedRow(row.id)}
											type="button"
										>
											<span class="size-8 shrink-0 rounded bg-[#d7e3df]" />
											<span class="min-w-0 flex-1 truncate text-[#3f4844] text-xs">
												{row.name}
											</span>
											<span class="text-[#59615d] text-[11px]">PNG</span>
										</button>
									)}
								</For>
							</div>
						</div>
					</Show>
				</section>
			</div>
		</section>
	);
}

function isManagerEntityArea(
	area: ManagerArea,
): area is keyof typeof MOCK_MANAGER_ENTITIES {
	return area === "projects" || area === "ips" || area === "characters";
}

function ManagerAreaIcon(props: { area: ManagerArea }) {
	switch (props.area) {
		case "projects":
			return <Folder aria-hidden="true" size={16} />;
		case "ips":
			return <Library aria-hidden="true" size={16} />;
		case "characters":
			return <Image aria-hidden="true" size={16} />;
		case "tagging":
			return <Bot aria-hidden="true" size={16} />;
		case "vectors":
			return <Share2 aria-hidden="true" size={16} />;
		case "duplicates":
			return <PanelsTopLeft aria-hidden="true" size={16} />;
		case "transfer":
			return <Database aria-hidden="true" size={16} />;
	}
}

function ManagerBatchToolPanel(props: {
	area: Exclude<ManagerArea, "characters" | "ips" | "projects" | "transfer">;
}) {
	const content = () => {
		switch (props.area) {
			case "tagging":
				return {
					action: "Scan for targets",
					description:
						"対象メディアを確認してから、AIタグ付けジョブを作成します。",
					title: "Batch tagging",
				};
			case "vectors":
				return {
					action: "Scan for targets",
					description: "類似検索に使用するCCIP特徴量を一括生成します。",
					title: "Vector extraction",
				};
			case "duplicates":
				return {
					action: "Scan for duplicates",
					description: "ファイル名と取得元URLから重複候補を検出します。",
					title: "Duplicate detection",
				};
		}
	};

	return (
		<div class="space-y-4">
			<div>
				<h2 class="font-semibold text-[#29322e] text-lg">{content().title}</h2>
				<p class="mt-0.5 text-[#626a66] text-xs">{content().description}</p>
			</div>

			<section class="rounded-md border border-[#dce2de] bg-white p-4">
				<div class="grid gap-4 lg:grid-cols-2">
					<div class="space-y-1.5">
						<Label class="text-[#3f4743] text-sm">Target source</Label>
						<Button class="w-full justify-between" variant="outline">
							All sources
							<ChevronDown aria-hidden="true" size={15} />
						</Button>
						<p class="text-[#68706c] text-xs">
							対象を限定しない場合はすべてのソースを走査します。
						</p>
					</div>
					<div class="space-y-1.5">
						<Label class="text-[#3f4743] text-sm">Existing results</Label>
						<Button class="w-full justify-between" variant="outline">
							Skip processed media
							<ChevronDown aria-hidden="true" size={15} />
						</Button>
						<p class="text-[#68706c] text-xs">
							既存結果を保持し、未処理のメディアだけを対象にします。
						</p>
					</div>
				</div>
				<div class="mt-4 flex justify-end border-[#e4e8e5] border-t pt-4">
					<Button class="w-full sm:w-auto">{content().action}</Button>
				</div>
			</section>

			<section aria-labelledby="recent-runs-title">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="font-medium text-[#343c38] text-sm" id="recent-runs-title">
						Recent runs
					</h3>
					<Button class="h-8 px-2 text-xs" variant="ghost">
						View all jobs
					</Button>
				</div>
				<div class="divide-y divide-[#e4e8e5] overflow-hidden rounded-md border border-[#dce2de] bg-white">
					<For each={MOCK_JOBS.slice(0, 3)}>
						{(job) => (
							<div class="flex min-h-14 items-center gap-3 px-4 py-2">
								<span class="min-w-0 flex-1">
									<strong class="block truncate font-medium text-[#343c38] text-sm">
										{job.name}
									</strong>
									<span class="block text-[#68706c] text-xs">
										{job.source} · {job.started}
									</span>
								</span>
								<JobStatus status={job.status} />
							</div>
						)}
					</For>
				</div>
			</section>
		</div>
	);
}

type TransferFormat = "archive" | "metadata";

function DataTransferToolPanel() {
	const [format, setFormat] = createSignal<TransferFormat>("metadata");
	const formats: Array<{
		description: string;
		label: string;
		value: TransferFormat;
	}> = [
		{
			description: "関連情報のみ・最小サイズ",
			label: "Metadata (NDJSON)",
			value: "metadata",
		},
		{
			description: "メディアファイルを含む完全な書き出し",
			label: "Archive (TAR)",
			value: "archive",
		},
	];

	return (
		<div class="space-y-4">
			<div>
				<h2 class="font-semibold text-[#29322e] text-lg">Data transfer</h2>
				<p class="mt-0.5 text-[#626a66] text-xs">
					ソース単位の書き出しと復元を、同じ場所から実行します。
				</p>
			</div>

			<div class="grid gap-4 xl:grid-cols-2">
				<section class="flex flex-col rounded-md border border-[#dce2de] bg-white p-4">
					<div>
						<p class="font-medium text-[#08766a] text-xs">Export</p>
						<h3 class="mt-1 font-semibold text-[#303935] text-base">
							Create a portable copy
						</h3>
						<p class="mt-1 text-[#626a66] text-xs leading-5">
							形式を選び、バックグラウンドジョブとして書き出します。
						</p>
					</div>

					<div class="mt-4 space-y-1.5">
						<Label class="text-[#3f4743] text-sm">Source</Label>
						<Button class="w-full justify-between" variant="outline">
							Local assets
							<ChevronDown aria-hidden="true" size={15} />
						</Button>
					</div>

					<fieldset class="mt-4">
						<legend class="mb-1.5 font-medium text-[#3f4743] text-sm">
							Format
						</legend>
						<div class="space-y-1.5">
							<For each={formats}>
								{(item) => (
									<button
										aria-pressed={format() === item.value}
										class={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] ${
											format() === item.value
												? "border-[#0b8f80] bg-[#eff8f5]"
												: "border-[#dce2de] hover:bg-[#f5f7f5]"
										}`}
										onClick={() => setFormat(item.value)}
										type="button"
									>
										<span
											aria-hidden="true"
											class={`size-3 shrink-0 rounded-full border ${
												format() === item.value
													? "border-[#0b8f80] bg-[#0b8f80] ring-2 ring-white"
													: "border-[#9ca5a0]"
											}`}
										/>
										<span class="min-w-0">
											<strong class="block font-medium text-[#343c38] text-sm">
												{item.label}
											</strong>
											<span class="block text-[#59615d] text-xs">
												{item.description}
											</span>
										</span>
									</button>
								)}
							</For>
						</div>
					</fieldset>

					<div class="mt-auto pt-4">
						<Button class="w-full">
							<Download aria-hidden="true" size={15} />
							Create export
						</Button>
					</div>
				</section>

				<section class="flex flex-col rounded-md border border-[#dce2de] bg-white p-4">
					<div>
						<p class="font-medium text-[#08766a] text-xs">Restore</p>
						<h3 class="mt-1 font-semibold text-[#303935] text-base">
							Import a previous export
						</h3>
						<p class="mt-1 text-[#626a66] text-xs leading-5">
							NDJSON・TARを自動判別し、選択したソースへ復元します。
						</p>
					</div>

					<div class="mt-4 space-y-1.5">
						<Label class="text-[#3f4743] text-sm">Destination</Label>
						<Button class="w-full justify-between" variant="outline">
							Local assets
							<ChevronDown aria-hidden="true" size={15} />
						</Button>
					</div>

					<button
						class="mt-4 flex min-h-48 w-full flex-col items-center justify-center rounded-md border border-[#aeb8b2] border-dashed bg-[#f8faf8] px-5 text-center outline-none hover:bg-[#f1f5f2] focus-visible:ring-2 focus-visible:ring-[#08766a]"
						type="button"
					>
						<DownloadCloud
							aria-hidden="true"
							class="rotate-180 text-[#08766a]"
							size={22}
						/>
						<strong class="mt-3 font-medium text-[#343c38] text-sm">
							Choose an export file
						</strong>
						<span class="mt-1 text-[#59615d] text-xs">
							.ndjson, .tar · drag and drop supported
						</span>
					</button>

					<p class="mt-3 flex items-start gap-2 rounded-md bg-[#f1f4f2] px-3 py-2 text-[#59615d] text-xs leading-5">
						<CircleAlert aria-hidden="true" class="mt-0.5 shrink-0" size={14} />
						復元は既存データへ追加・更新されます。実行前に内容を検証します。
					</p>
				</section>
			</div>

			<p class="text-[#59615d] text-xs">
				作成・復元の進捗と失敗内容はJobsで確認できます。
			</p>
		</div>
	);
}

function DesignManagerScreen() {
	const [area, setArea] = createSignal<ManagerArea>("projects");
	const [query, setQuery] = createSignal("");
	const [selectedId, setSelectedId] = createSignal(
		MOCK_MANAGER_ENTITIES.projects[0].id,
	);
	const activeArea = () =>
		MANAGER_AREAS.find((item) => item.value === area()) ?? MANAGER_AREAS[0];
	const entities = createMemo(() => {
		const active = area();
		if (!isManagerEntityArea(active)) return [];
		const normalizedQuery = query().trim().toLocaleLowerCase();
		if (!normalizedQuery) return MOCK_MANAGER_ENTITIES[active];
		return MOCK_MANAGER_ENTITIES[active].filter((item) =>
			`${item.name} ${item.description}`
				.toLocaleLowerCase()
				.includes(normalizedQuery),
		);
	});
	const selectedEntity = () => {
		const active = area();
		if (!isManagerEntityArea(active)) return undefined;
		return (
			MOCK_MANAGER_ENTITIES[active].find((item) => item.id === selectedId()) ??
			MOCK_MANAGER_ENTITIES[active][0]
		);
	};
	const changeArea = (nextArea: ManagerArea) => {
		setArea(nextArea);
		setQuery("");
		if (isManagerEntityArea(nextArea)) {
			setSelectedId(MOCK_MANAGER_ENTITIES[nextArea][0]?.id ?? "");
		}
	};

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-5 py-4 sm:px-6">
				<p class="font-medium text-[#08766a] text-xs">Workspace</p>
				<h1 class="mt-1 font-semibold text-[#242927] text-xl">Manager</h1>
				<p class="mt-1 text-[#626a66] text-sm">
					分類データの編集と、一括処理の起点をまとめます。
				</p>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
				<nav
					aria-label="Manager categories"
					class="sticky top-0 z-10 flex gap-1 overflow-x-auto border-[#e1e5e2] border-b bg-[#fafbf9]/95 px-4 py-2 backdrop-blur lg:hidden"
				>
					<For each={MANAGER_AREAS}>
						{(item) => (
							<Button
								aria-current={area() === item.value ? "page" : undefined}
								class={`h-12 shrink-0 px-3 text-xs sm:h-9 ${
									area() === item.value
										? "bg-[#e1f1ed] text-[#05695f]"
										: "text-[#59615d]"
								}`}
								onClick={() => changeArea(item.value)}
								variant="ghost"
							>
								{item.label}
							</Button>
						)}
					</For>
				</nav>

				<div class="grid w-full gap-6 px-4 py-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8 lg:px-6 xl:px-8">
					<nav aria-label="Manager categories" class="hidden lg:block">
						<div class="sticky top-5 space-y-5">
							<For each={["Entities", "Tools"] as const}>
								{(group) => (
									<div>
										<p class="mb-1 px-2.5 font-medium text-[#59615d] text-[10px] uppercase tracking-[0.12em]">
											{group}
										</p>
										<div class="space-y-0.5">
											<For
												each={MANAGER_AREAS.filter(
													(item) => item.group === group,
												)}
											>
												{(item) => (
													<button
														aria-current={
															area() === item.value ? "page" : undefined
														}
														class={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] ${
															area() === item.value
																? "bg-[#e1f1ed] text-[#05695f]"
																: "text-[#555d59] hover:bg-[#edf0ed]"
														}`}
														onClick={() => changeArea(item.value)}
														type="button"
													>
														<span class="shrink-0">
															<ManagerAreaIcon area={item.value} />
														</span>
														<span class="min-w-0">
															<strong class="block truncate font-medium text-sm">
																{item.label}
															</strong>
															<span class="block truncate text-[#626a66] text-[11px]">
																{item.description}
															</span>
														</span>
													</button>
												)}
											</For>
										</div>
									</div>
								)}
							</For>
						</div>
					</nav>

					<Show
						fallback={
							<Show
								fallback={
									<ManagerBatchToolPanel
										area={
											area() as Exclude<
												ManagerArea,
												"characters" | "ips" | "projects" | "transfer"
											>
										}
									/>
								}
								when={area() === "transfer"}
							>
								<DataTransferToolPanel />
							</Show>
						}
						when={isManagerEntityArea(area())}
					>
						<div class="min-w-0">
							<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
								<div>
									<h2 class="font-semibold text-[#29322e] text-lg">
										{activeArea().label}
									</h2>
									<p class="mt-0.5 text-[#626a66] text-xs">
										{activeArea().description}を管理します。
									</p>
								</div>
								<Button class="w-full sm:w-auto">
									<Plus aria-hidden="true" size={15} />
									New {activeArea().label.replace(/s$/, "")}
								</Button>
							</div>

							<div class="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
								<div class="min-w-0">
									<div class="relative mb-3">
										<Search
											aria-hidden="true"
											class="absolute top-1/2 left-3 -translate-y-1/2 text-[#727a76]"
											size={15}
										/>
										<Input
											aria-label={`${activeArea().label}を検索`}
											class="h-9 border-[#d9dfdb] bg-white pl-9 shadow-none focus-visible:ring-[#0b8f80]"
											onInput={(event) => setQuery(event.currentTarget.value)}
											placeholder={`Search ${activeArea().label.toLocaleLowerCase()}...`}
											value={query()}
										/>
									</div>

									<div class="overflow-x-auto rounded-md border border-[#dce2de] bg-white">
										<table class="w-full border-collapse text-left text-sm">
											<thead class="bg-[#f4f6f4] text-[#68706c] text-xs">
												<tr>
													<th class="px-4 py-2 font-medium" scope="col">
														Name
													</th>
													<th
														class="hidden px-4 py-2 font-medium md:table-cell"
														scope="col"
													>
														Relations
													</th>
													<th
														class="px-4 py-2 text-right font-medium"
														scope="col"
													>
														Media
													</th>
													<th
														class="hidden px-4 py-2 text-right font-medium sm:table-cell"
														scope="col"
													>
														Modified
													</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-[#e5e9e6]">
												<For each={entities()}>
													{(item) => (
														<tr
															class={
																selectedId() === item.id
																	? "bg-[#f0f7f5]"
																	: "hover:bg-[#f6f8f6]"
															}
														>
															<th class="p-0 font-normal" scope="row">
																<button
																	aria-pressed={selectedId() === item.id}
																	class="block min-h-14 w-full px-4 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#08766a]"
																	onClick={() => setSelectedId(item.id)}
																	type="button"
																>
																	<strong class="block truncate font-medium text-[#303935] text-sm">
																		{item.name}
																	</strong>
																	<span class="block max-w-[42ch] truncate text-[#59615d] text-xs">
																		{item.description}
																	</span>
																</button>
															</th>
															<td class="hidden max-w-48 truncate px-4 py-2 text-[#626a66] text-xs md:table-cell">
																{item.relations.join(", ")}
															</td>
															<td class="px-4 py-2 text-right font-medium text-[#3e4743] text-xs">
																{item.mediaCount}
															</td>
															<td class="hidden px-4 py-2 text-right text-[#59615d] text-xs sm:table-cell">
																{item.modified}
															</td>
														</tr>
													)}
												</For>
											</tbody>
										</table>
									</div>
									<p class="mt-2 text-[#59615d] text-xs">
										{entities().length} items
									</p>
								</div>

								<Show when={selectedEntity()}>
									{(item) => (
										<aside
											aria-label="選択中の項目"
											class="hidden self-start rounded-md border border-[#dce2de] bg-white p-4 xl:block"
										>
											<p class="text-[#59615d] text-xs">
												Selected {activeArea().label.replace(/s$/, "")}
											</p>
											<h3 class="mt-1 break-words font-semibold text-[#29322e] text-base">
												{item().name}
											</h3>
											<p class="mt-2 text-[#626a66] text-xs leading-5">
												{item().description}
											</p>
											<dl class="mt-4 space-y-3 border-[#e4e8e5] border-y py-4 text-xs">
												<div class="flex justify-between gap-3">
													<dt class="text-[#59615d]">Media</dt>
													<dd class="font-medium text-[#343c38]">
														{item().mediaCount}
													</dd>
												</div>
												<div class="flex justify-between gap-3">
													<dt class="text-[#59615d]">Modified</dt>
													<dd class="text-[#343c38]">{item().modified}</dd>
												</div>
											</dl>
											<div class="mt-4">
												<p class="mb-2 font-medium text-[#343c38] text-xs">
													Relations
												</p>
												<div class="flex flex-wrap gap-1.5">
													<For each={item().relations}>
														{(relation) => (
															<Badge variant="secondary">{relation}</Badge>
														)}
													</For>
												</div>
											</div>
											<div class="mt-5 grid grid-cols-2 gap-2">
												<Button variant="outline">Edit</Button>
												<Button class="text-[#a13f38]" variant="outline">
													Delete
												</Button>
											</div>
										</aside>
									)}
								</Show>
							</div>
						</div>
					</Show>
				</div>
			</div>
		</section>
	);
}

type JobFilter = "active" | "all" | "completed" | "failed";

function jobStatusLabel(status: MockJob["status"]) {
	switch (status) {
		case "running":
			return "Running";
		case "queued":
			return "Queued";
		case "failed":
			return "Failed";
		case "completed":
			return "Completed";
	}
}

function JobStatus(props: { status: MockJob["status"] }) {
	return (
		<span
			class={`inline-flex h-6 items-center gap-1.5 rounded-full px-2 font-medium text-[11px] ${
				props.status === "running"
					? "bg-[#e2f2ed] text-[#087367]"
					: props.status === "queued"
						? "bg-[#edf0ee] text-[#59615d]"
						: props.status === "failed"
							? "bg-[#f9e8e6] text-[#a03e37]"
							: "bg-[#e9f0ea] text-[#3d6848]"
			}`}
		>
			<Show when={props.status === "running"}>
				<span
					aria-hidden="true"
					class="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
				/>
			</Show>
			{jobStatusLabel(props.status)}
		</span>
	);
}

function JobsScreen() {
	const [filter, setFilter] = createSignal<JobFilter>("all");
	const [selectedId, setSelectedId] = createSignal(MOCK_JOBS[0].id);
	const filteredJobs = createMemo(() => {
		switch (filter()) {
			case "active":
				return MOCK_JOBS.filter(
					(job) => job.status === "running" || job.status === "queued",
				);
			case "failed":
				return MOCK_JOBS.filter((job) => job.status === "failed");
			case "completed":
				return MOCK_JOBS.filter((job) => job.status === "completed");
			case "all":
				return MOCK_JOBS;
		}
	});
	const selectedJob = () =>
		MOCK_JOBS.find((job) => job.id === selectedId()) ?? MOCK_JOBS[0];
	const progress = (job: MockJob) =>
		job.total === 0 ? 0 : Math.round((job.completed / job.total) * 100);
	const changeFilter = (nextFilter: JobFilter) => {
		setFilter(nextFilter);
		const firstMatch = (() => {
			switch (nextFilter) {
				case "active":
					return MOCK_JOBS.find(
						(job) => job.status === "running" || job.status === "queued",
					);
				case "failed":
					return MOCK_JOBS.find((job) => job.status === "failed");
				case "completed":
					return MOCK_JOBS.find((job) => job.status === "completed");
				case "all":
					return MOCK_JOBS[0];
			}
		})();
		if (firstMatch) setSelectedId(firstMatch.id);
	};

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-6 py-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<p class="font-medium text-[#08766a] text-xs">Workspace</p>
						<h1 class="mt-1 font-semibold text-[#242927] text-xl">Jobs</h1>
						<p class="mt-1 text-[#626a66] text-sm">
							バックグラウンド処理の進捗、失敗、履歴を確認します。
						</p>
					</div>
					<div class="flex items-center gap-2 rounded-md border border-[#dce2de] bg-white px-3 py-2 text-[#59615d] text-xs">
						<span class="size-2 animate-pulse rounded-full bg-[#20a276] motion-reduce:animate-none" />
						Live updates
					</div>
				</div>
			</header>

			<div class="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div class="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 [scrollbar-gutter:stable]">
					<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
						<div class="flex flex-wrap gap-1 rounded-md bg-[#eef1ee] p-1">
							<For
								each={
									[
										{ label: "All", value: "all" },
										{ label: "Active", value: "active" },
										{ label: "Failed", value: "failed" },
										{ label: "Completed", value: "completed" },
									] as const
								}
							>
								{(option) => (
									<Button
										aria-pressed={filter() === option.value}
										class={`h-8 px-3 text-xs shadow-none ${
											filter() === option.value
												? "bg-white text-[#26302c]"
												: "text-[#626a66]"
										}`}
										onClick={() => changeFilter(option.value)}
										size="sm"
										variant="ghost"
									>
										{option.label}
									</Button>
								)}
							</For>
						</div>
						<p class="text-[#68706c] text-xs">{filteredJobs().length} jobs</p>
					</div>

					<div class="overflow-hidden rounded-lg border border-[#dce2de] bg-white">
						<For each={filteredJobs()}>
							{(job) => (
								<article
									class={`border-[#e3e7e4] border-b p-4 last:border-b-0 ${
										selectedId() === job.id ? "bg-[#f4f9f7]" : ""
									}`}
								>
									<div class="flex min-w-0 items-start gap-3">
										<button
											aria-pressed={selectedId() === job.id}
											class="min-w-0 flex-1 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] focus-visible:ring-offset-2"
											onClick={() => setSelectedId(job.id)}
											type="button"
										>
											<span class="flex flex-wrap items-center gap-2">
												<strong class="min-w-0 truncate font-medium text-[#28312d] text-sm">
													{job.name}
												</strong>
												<JobStatus status={job.status} />
											</span>
											<span class="mt-1 block text-[#68706c] text-xs">
												{job.source} · {job.type} · {job.started}
											</span>
										</button>
										<Show when={job.status === "failed"}>
											<Button class="h-8 px-2" size="sm" variant="outline">
												<RotateCcw aria-hidden="true" size={14} />
												Retry
											</Button>
										</Show>
									</div>
									<Show when={job.status === "running"}>
										<div class="mt-3" role="status">
											<div class="mb-1.5 flex justify-between text-[#59615d] text-[11px]">
												<span>{progress(job)}%</span>
												<span>
													{job.completed} / {job.total}
												</span>
											</div>
											<Progress
												aria-label={`${job.name}の進捗`}
												class="h-1.5 bg-[#dfe7e3] [&>div>div]:bg-[#0b8f80] [&>div]:bg-[#dfe7e3]"
												value={progress(job)}
											/>
										</div>
									</Show>
									<Show when={job.error}>
										<p class="mt-3 flex items-start gap-2 rounded-md bg-[#fdf4f2] px-3 py-2 text-[#934139] text-xs">
											<CircleAlert
												aria-hidden="true"
												class="mt-0.5 shrink-0"
												size={14}
											/>
											{job.error}
										</p>
									</Show>
								</article>
							)}
						</For>
					</div>
				</div>

				<aside
					aria-label="選択中のジョブ"
					class="hidden min-h-0 overflow-y-auto overscroll-contain border-[#e1e5e2] border-l bg-[#fbfcfa] p-5 xl:block"
				>
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="text-[#68706c] text-xs">選択中のジョブ</p>
							<h2 class="mt-1 truncate font-semibold text-[#252b28] text-base">
								{selectedJob().name}
							</h2>
						</div>
						<JobStatus status={selectedJob().status} />
					</div>

					<dl class="mt-5 space-y-3 border-[#e1e5e2] border-y py-4 text-xs">
						<div class="flex justify-between gap-3">
							<dt class="text-[#68706c]">Source</dt>
							<dd class="text-right font-medium text-[#343c38]">
								{selectedJob().source}
							</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-[#68706c]">Type</dt>
							<dd class="text-right text-[#343c38]">{selectedJob().type}</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-[#68706c]">Started</dt>
							<dd class="text-right text-[#343c38]">{selectedJob().started}</dd>
						</div>
						<div class="flex justify-between gap-3">
							<dt class="text-[#68706c]">Job ID</dt>
							<dd class="truncate text-right font-mono text-[#343c38]">
								{selectedJob().id}
							</dd>
						</div>
					</dl>

					<section class="mt-5">
						<h3 class="font-medium text-[#343c38] text-sm">Batch progress</h3>
						<div class="mt-3 grid grid-cols-3 gap-2 text-center">
							<div class="rounded-md bg-[#edf5f2] p-3">
								<CircleCheck
									aria-hidden="true"
									class="mx-auto text-[#218269]"
									size={16}
								/>
								<strong class="mt-1 block text-[#2f3935] text-sm">
									{selectedJob().completed}
								</strong>
								<span class="text-[#626a66] text-[10px]">Done</span>
							</div>
							<div class="rounded-md bg-[#f2f3f1] p-3">
								<Clock3
									aria-hidden="true"
									class="mx-auto text-[#68706c]"
									size={16}
								/>
								<strong class="mt-1 block text-[#2f3935] text-sm">
									{Math.max(selectedJob().total - selectedJob().completed, 0)}
								</strong>
								<span class="text-[#626a66] text-[10px]">Remaining</span>
							</div>
							<div class="rounded-md bg-[#f9ece9] p-3">
								<CircleAlert
									aria-hidden="true"
									class="mx-auto text-[#a34a42]"
									size={16}
								/>
								<strong class="mt-1 block text-[#2f3935] text-sm">
									{selectedJob().status === "failed" ? 1 : 0}
								</strong>
								<span class="text-[#626a66] text-[10px]">Failed</span>
							</div>
						</div>
					</section>

					<div class="mt-5 space-y-2">
						<Show when={selectedJob().status === "failed"}>
							<Button class="w-full">
								<RotateCcw aria-hidden="true" size={15} />
								Retry job
							</Button>
						</Show>
						<Show
							when={
								selectedJob().status === "queued" ||
								selectedJob().status === "running"
							}
						>
							<Button class="w-full" variant="outline">
								<Ban aria-hidden="true" size={15} />
								Cancel job
							</Button>
						</Show>
					</div>
				</aside>
			</div>
		</section>
	);
}

const SETTINGS_CATEGORIES: Array<{
	description: string;
	label: string;
	value: SettingsCategory;
}> = [
	{
		description: "並列数と自動処理",
		label: "Jobs",
		value: "jobs",
	},
	{
		description: "推論サービス接続",
		label: "AI",
		value: "ai",
	},
	{
		description: "取得速度と制限",
		label: "Downloads",
		value: "downloads",
	},
	{
		description: "サムネイルと保存先",
		label: "Storage",
		value: "storage",
	},
	{
		description: "形式とメタデータ",
		label: "Media",
		value: "media",
	},
	{
		description: "出力レベル",
		label: "Logging",
		value: "logging",
	},
];

function SettingsCategoryIcon(props: { category: SettingsCategory }) {
	switch (props.category) {
		case "jobs":
			return <BriefcaseBusiness aria-hidden="true" size={16} />;
		case "ai":
			return <Bot aria-hidden="true" size={16} />;
		case "downloads":
			return <DownloadCloud aria-hidden="true" size={16} />;
		case "storage":
			return <HardDrive aria-hidden="true" size={16} />;
		case "media":
			return <Image aria-hidden="true" size={16} />;
		case "logging":
			return <Logs aria-hidden="true" size={16} />;
	}
}

function SettingsInput(props: {
	description?: string;
	id: string;
	label: string;
	onInput: (value: string) => void;
	placeholder?: string;
	type?: "number" | "text" | "url";
	value: string;
}) {
	const descriptionId = () => `${props.id}-description`;
	return (
		<div class="space-y-1.5">
			<Label class="text-[#3f4743] text-sm" for={props.id}>
				{props.label}
			</Label>
			<Input
				aria-describedby={props.description ? descriptionId() : undefined}
				class="min-h-12 border-[#d9dfdb] bg-white text-base shadow-none focus-visible:ring-[#0b8f80] sm:min-h-9 sm:text-sm"
				id={props.id}
				name={props.id}
				onInput={(event) => props.onInput(event.currentTarget.value)}
				placeholder={props.placeholder}
				type={props.type ?? "text"}
				value={props.value}
			/>
			<Show when={props.description}>
				<p
					class="text-[#68706c] text-xs leading-5 sm:leading-4"
					id={descriptionId()}
				>
					{props.description}
				</p>
			</Show>
		</div>
	);
}

function SettingsToggle(props: {
	checked: boolean;
	description: string;
	label: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<Switch
			checked={props.checked}
			class="flex min-h-14 items-center justify-between gap-3 sm:min-h-10"
			onChange={props.onChange}
		>
			<div class="min-w-0">
				<SwitchLabel class="text-[#38413d] text-sm">{props.label}</SwitchLabel>
				<p class="mt-1 text-[#68706c] text-xs leading-5 sm:mt-0.5 sm:leading-4">
					{props.description}
				</p>
			</div>
			<SwitchControl class="data-[checked]:bg-[#0b8f80]">
				<SwitchThumb />
			</SwitchControl>
		</Switch>
	);
}

function SettingsSection(props: {
	children: JSX.Element;
	description: string;
	title: string;
}) {
	return (
		<fieldset class="rounded-md border border-[#dce2de] bg-white p-4 sm:px-4 sm:py-3">
			<legend class="px-1 font-semibold text-[#29322e] text-sm">
				{props.title}
			</legend>
			<p class="mb-4 text-[#68706c] text-xs leading-5 sm:mb-3 sm:leading-4">
				{props.description}
			</p>
			<div class="space-y-4 sm:space-y-3">{props.children}</div>
		</fieldset>
	);
}

function SettingsScreen() {
	const [category, setCategory] = createSignal<SettingsCategory>("jobs");
	const [dirty, setDirty] = createSignal(false);
	const [saved, setSaved] = createSignal(false);
	const [autoTagging, setAutoTagging] = createSignal(true);
	const [autoVectors, setAutoVectors] = createSignal(false);
	const [rateLimit, setRateLimit] = createSignal(true);
	const [settingsDraft, setSettingsDraft] = createStore<SettingsDraft>({
		...INITIAL_SETTINGS_DRAFT,
	});
	const markDirty = () => {
		setDirty(true);
		setSaved(false);
	};
	const changeToggle = (setter: (value: boolean) => void, value: boolean) => {
		setter(value);
		markDirty();
	};
	const changeSetting = (key: keyof SettingsDraft, value: string) => {
		setSettingsDraft(key, value);
		markDirty();
	};
	const discardChanges = () => {
		setSettingsDraft({ ...INITIAL_SETTINGS_DRAFT });
		setAutoTagging(true);
		setAutoVectors(false);
		setRateLimit(true);
		setDirty(false);
		setSaved(false);
	};
	const activeCategory = () =>
		SETTINGS_CATEGORIES.find((item) => item.value === category()) ??
		SETTINGS_CATEGORIES[0];

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-5 py-4 sm:px-6">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="font-medium text-[#08766a] text-xs">Workspace</p>
						<h1 class="mt-1 font-semibold text-[#242927] text-xl">Settings</h1>
						<p class="mt-1 text-[#626a66] text-sm">
							アプリケーション全体の動作と接続先を管理します。
						</p>
					</div>
					<Show when={saved()}>
						<p
							class="flex items-center gap-1.5 text-[#28745e] text-xs"
							role="status"
						>
							<CircleCheck aria-hidden="true" size={15} />
							Saved
						</p>
					</Show>
				</div>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
				<div class="sticky top-0 z-10 border-[#e1e5e2] border-b bg-[#fafbf9]/95 px-4 py-2 backdrop-blur lg:hidden">
					<nav
						aria-label="設定カテゴリ"
						class="flex gap-1 overflow-x-auto overscroll-x-contain"
					>
						<For each={SETTINGS_CATEGORIES}>
							{(item) => (
								<Button
									aria-current={category() === item.value ? "page" : undefined}
									class={`h-12 shrink-0 px-3 text-xs sm:h-9 ${
										category() === item.value
											? "bg-[#e1f1ed] text-[#05695f]"
											: "text-[#59615d]"
									}`}
									onClick={() => setCategory(item.value)}
									size="sm"
									variant="ghost"
								>
									{item.label}
								</Button>
							)}
						</For>
					</nav>
				</div>

				<div class="grid w-full gap-6 px-4 py-5 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8 lg:px-6 lg:py-5 xl:px-8">
					<nav aria-label="設定カテゴリ" class="hidden lg:block">
						<div class="sticky top-5 space-y-0.5">
							<For each={SETTINGS_CATEGORIES}>
								{(item) => (
									<button
										aria-current={
											category() === item.value ? "page" : undefined
										}
										class={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#08766a] ${
											category() === item.value
												? "bg-[#e1f1ed] text-[#05695f]"
												: "text-[#555d59] hover:bg-[#edf0ed]"
										}`}
										onClick={() => setCategory(item.value)}
										type="button"
									>
										<span class="shrink-0">
											<SettingsCategoryIcon category={item.value} />
										</span>
										<span class="min-w-0">
											<strong class="block font-medium text-sm">
												{item.label}
											</strong>
											<span class="block truncate text-[#626a66] text-[11px]">
												{item.description}
											</span>
										</span>
									</button>
								)}
							</For>
						</div>
					</nav>

					<form
						class="min-w-0 space-y-3 pb-16"
						onSubmit={(event) => {
							event.preventDefault();
							setDirty(false);
							setSaved(true);
						}}
					>
						<div>
							<h2 class="font-semibold text-[#29322e] text-lg">
								{activeCategory().label}
							</h2>
							<p class="mt-0.5 text-[#68706c] text-xs">
								{activeCategory().description}
							</p>
						</div>

						<Show when={category() === "jobs"}>
							<SettingsSection
								description="通常処理とAI処理の同時実行数を個別に制御します。"
								title="Concurrency"
							>
								<div class="grid gap-4 sm:grid-cols-2 sm:gap-3">
									<SettingsInput
										description="ダウンロード、同期などの同時実行数"
										id="settings-job-concurrency"
										label="General jobs"
										onInput={(value) =>
											changeSetting("generalConcurrency", value)
										}
										type="number"
										value={settingsDraft.generalConcurrency}
									/>
									<SettingsInput
										description="タグ抽出、ベクトル生成の同時実行数"
										id="settings-ai-concurrency"
										label="AI jobs"
										onInput={(value) => changeSetting("aiConcurrency", value)}
										type="number"
										value={settingsDraft.aiConcurrency}
									/>
								</div>
							</SettingsSection>
							<SettingsSection
								description="メディア追加時に自動で投入するジョブを選びます。"
								title="Automatic processing"
							>
								<div class="divide-y divide-[#e3e7e4]">
									<SettingsToggle
										checked={autoTagging()}
										description="新しい画像へAIタグを自動付与します。"
										label="Auto tagging"
										onChange={(value) => changeToggle(setAutoTagging, value)}
									/>
									<SettingsToggle
										checked={autoVectors()}
										description="類似検索用CCIPベクトルを自動生成します。"
										label="Auto vector extraction"
										onChange={(value) => changeToggle(setAutoVectors, value)}
									/>
								</div>
							</SettingsSection>
						</Show>

						<Show when={category() === "ai"}>
							<SettingsSection
								description="空欄の場合はローカルAIサービスを使用します。"
								title="AI service"
							>
								<SettingsInput
									description="solid-imager oRPCエンドポイント"
									id="settings-ai-url"
									label="Remote server URL"
									onInput={(value) => changeSetting("aiUrl", value)}
									placeholder="http://power-machine:3000"
									type="url"
									value={settingsDraft.aiUrl}
								/>
								<SettingsInput
									description="応答がない場合に失敗と判定する時間"
									id="settings-ai-timeout"
									label="Timeout (ms)"
									onInput={(value) => changeSetting("aiTimeout", value)}
									type="number"
									value={settingsDraft.aiTimeout}
								/>
								<div class="flex items-center justify-between rounded-md bg-[#edf5f2] px-3 py-2 text-xs">
									<span class="text-[#4d5954]">Connection status</span>
									<span class="flex items-center gap-1.5 font-medium text-[#17745f]">
										<span class="size-1.5 rounded-full bg-current" />
										Connected · 18 ms
									</span>
								</div>
							</SettingsSection>
						</Show>

						<Show when={category() === "downloads"}>
							<SettingsSection
								description="外部サイトへのリクエスト頻度を制御します。"
								title="Rate limiting"
							>
								<SettingsToggle
									checked={rateLimit()}
									description="連続取得時にリクエスト間隔を適用します。"
									label="Enable rate limit"
									onChange={(value) => changeToggle(setRateLimit, value)}
								/>
								<SettingsInput
									description="0〜60,000ms"
									id="settings-request-interval"
									label="Request interval (ms)"
									onInput={(value) => changeSetting("requestInterval", value)}
									type="number"
									value={settingsDraft.requestInterval}
								/>
							</SettingsSection>
						</Show>

						<Show when={category() === "storage"}>
							<SettingsSection
								description="一覧表示用サムネイルの保存場所と生成品質です。"
								title="Thumbnails"
							>
								<SettingsInput
									id="settings-thumbnail-directory"
									label="Thumbnail directory"
									onInput={(value) =>
										changeSetting("thumbnailDirectory", value)
									}
									value={settingsDraft.thumbnailDirectory}
								/>
								<div class="grid gap-4 sm:grid-cols-2 sm:gap-3">
									<SettingsInput
										id="settings-thumbnail-size"
										label="Size (px)"
										onInput={(value) => changeSetting("thumbnailSize", value)}
										type="number"
										value={settingsDraft.thumbnailSize}
									/>
									<SettingsInput
										id="settings-thumbnail-quality"
										label="Quality (1–100)"
										onInput={(value) =>
											changeSetting("thumbnailQuality", value)
										}
										type="number"
										value={settingsDraft.thumbnailQuality}
									/>
								</div>
							</SettingsSection>
						</Show>

						<Show when={category() === "media"}>
							<SettingsSection
								description="カンマ区切りで読み込み対象の拡張子を指定します。"
								title="Supported extensions"
							>
								<SettingsInput
									id="settings-image-extensions"
									label="Images"
									onInput={(value) => changeSetting("imageExtensions", value)}
									value={settingsDraft.imageExtensions}
								/>
								<SettingsInput
									id="settings-video-extensions"
									label="Videos"
									onInput={(value) => changeSetting("videoExtensions", value)}
									value={settingsDraft.videoExtensions}
								/>
							</SettingsSection>
						</Show>

						<Show when={category() === "logging"}>
							<SettingsSection
								description="通常運用ではInfoを推奨します。"
								title="Log output"
							>
								<div class="space-y-1.5">
									<Label for="settings-log-level">Log level</Label>
									<select
										class="flex min-h-12 w-full rounded-md border border-[#d9dfdb] bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-[#0b8f80] sm:min-h-9 sm:text-sm"
										id="settings-log-level"
										name="settings-log-level"
										onInput={(event) =>
											changeSetting("logLevel", event.currentTarget.value)
										}
										value={settingsDraft.logLevel}
									>
										<option>Trace</option>
										<option>Debug</option>
										<option>Info</option>
										<option>Warn</option>
										<option>Error</option>
									</select>
								</div>
							</SettingsSection>
						</Show>

						<Show when={dirty()}>
							<div class="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#cfd8d3] bg-white/95 p-3 shadow-lg backdrop-blur">
								<p class="text-[#505a55] text-xs">未保存の変更があります</p>
								<div class="flex gap-2">
									<Button
										class="h-9"
										onClick={discardChanges}
										size="sm"
										type="button"
										variant="ghost"
									>
										Discard
									</Button>
									<Button class="h-9" size="sm" type="submit">
										Save changes
									</Button>
								</div>
							</div>
						</Show>
					</form>
				</div>
			</div>
		</section>
	);
}

function OverlayPatternsScreen(props: { onOpenJobs: () => void }) {
	const [modalOpen, setModalOpen] = createSignal(false);
	const [modalTags, setModalTags] = createSignal("");
	const [drawerOpen, setDrawerOpen] = createSignal(false);
	const [discardTarget, setDiscardTarget] = createSignal<"modal" | "drawer">();
	const [drawerDraft, setDrawerDraft] = createSignal<DrawerDraft>({
		...EMPTY_DRAWER_DRAFT,
	});
	const isDrawerDirty = createMemo(() =>
		Object.values(drawerDraft()).some((value) => value.length > 0),
	);
	const isModalDirty = createMemo(() => modalTags().length > 0);

	function closeModal() {
		setDiscardTarget();
		setModalOpen(false);
		setModalTags("");
	}

	function requestModalClose() {
		if (isModalDirty()) {
			setDiscardTarget("modal");
			return;
		}
		closeModal();
	}

	function handleModalOpenChange(open: boolean) {
		if (open) {
			setModalOpen(true);
			return;
		}
		requestModalClose();
	}

	function resetDrawerDraft() {
		setDrawerDraft({ ...EMPTY_DRAWER_DRAFT });
	}

	function closeDrawer() {
		setDiscardTarget();
		setDrawerOpen(false);
		resetDrawerDraft();
	}

	function requestDrawerClose() {
		if (isDrawerDirty()) {
			setDiscardTarget("drawer");
			return;
		}
		closeDrawer();
	}

	function handleDrawerOpenChange(open: boolean) {
		if (open) {
			setDrawerOpen(true);
			return;
		}
		requestDrawerClose();
	}

	function updateDrawerDraft(key: keyof DrawerDraft, value: string) {
		setDrawerDraft((current) => ({ ...current, [key]: value }));
	}

	function discardPendingChanges() {
		if (discardTarget() === "modal") {
			closeModal();
			return;
		}
		closeDrawer();
	}

	function showSuccessToast() {
		toast.success("4件のメディアを取り込みました", {
			description: "Local assets に追加されています。",
			duration: 4000,
		});
	}

	function showJobToast() {
		toast.info("エクスポートをJobsへ追加しました", {
			action: {
				label: "Jobsを見る",
				onClick: props.onOpenJobs,
			},
			description: "処理中もライブラリで作業を続けられます。",
			duration: 7000,
		});
	}

	function showWarningToast() {
		toast.warning("Inboxとの接続が不安定です", {
			action: {
				label: "再接続",
				onClick: () =>
					toast.success("Inboxへ再接続しました", {
						description: "保留中の4件を同期しています。",
					}),
			},
			description: "新しい投稿の反映が遅れる可能性があります。",
			duration: 8000,
		});
	}

	function showErrorToast() {
		toast.error("タグ抽出を開始できませんでした", {
			action: {
				label: "再試行",
				onClick: () =>
					toast.info("タグ抽出をJobsへ追加しました", {
						description: "完了後にメディアへ自動反映します。",
					}),
			},
			description: "AIサービスへの接続を確認してください。",
			duration: 9000,
			important: true,
		});
	}

	return (
		<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
			<header class="border-[#e1e5e2] border-b bg-[#fbfcfa] px-6 py-5">
				<p class="mb-1 font-medium text-[#08766a] text-xs">
					Design lab / Overlays
				</p>
				<h1 class="font-semibold text-[#202624] text-xl">重なって表示するUI</h1>
				<p class="mt-2 max-w-2xl text-[#626a66] text-sm leading-6">
					操作の重さと編集量で使い分けます。同じ用途を複数の形式で実装しません。
				</p>
			</header>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [scrollbar-gutter:stable]">
				<div class="grid gap-4 lg:grid-cols-3">
					<PatternCard
						description="並び順や表示密度など、その場で完了する軽い設定。背面の内容は操作可能なままです。"
						label="LIGHT / NON-MODAL"
						title="Popover"
					>
						<Popover placement="bottom-start">
							<PopoverTrigger
								class={buttonVariants({
									class: "w-full border-[#d6dcd8] bg-white shadow-none",
									variant: "outline",
								})}
							>
								表示設定を開く
								<ChevronDown aria-hidden="true" size={14} />
							</PopoverTrigger>
							<PopoverContent class="w-72 border-[#dfe4e1] bg-[#fbfcfa] shadow-xl">
								<h3 class="font-semibold text-[#2d3431] text-sm">表示設定</h3>
								<p class="mt-1 text-[#68706c] text-xs">
									変更はすぐ一覧へ反映します。
								</p>
								<div class="mt-4 space-y-2">
									<Button
										class="w-full justify-between"
										size="sm"
										variant="ghost"
									>
										サムネイルを大きく
										<span class="text-[#08766a]">選択中</span>
									</Button>
									<Button
										class="w-full justify-between"
										size="sm"
										variant="ghost"
									>
										ファイル名を表示
										<span class="text-[#68706c]">オフ</span>
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					</PatternCard>

					<PatternCard
						description="削除確認や一括変更など、回答するまで背面を触らせない短い作業。内容は一画面以内に収めます。"
						label="FOCUSED / MODAL"
						title="Modal"
					>
						<Dialog onOpenChange={handleModalOpenChange} open={modalOpen()}>
							<DialogTrigger
								class={buttonVariants({
									class: "w-full bg-[#08766a] hover:bg-[#06645a]",
								})}
							>
								一括編集を開く
							</DialogTrigger>
							<DialogContent
								class="border-[#dce2de] bg-[#fbfcfa] motion-reduce:animate-none"
								onEscapeKeyDown={(event) => {
									if (!isModalDirty()) return;
									event.preventDefault();
									setDiscardTarget("modal");
								}}
								onPointerDownOutside={(event) => {
									if (!isModalDirty()) return;
									event.preventDefault();
									setDiscardTarget("modal");
								}}
							>
								<DialogHeader>
									<DialogTitle>選択した12件を一括編集</DialogTitle>
									<DialogDescription>
										入力したタグを、選択中のすべてのメディアへ追加します。
									</DialogDescription>
								</DialogHeader>
								<div class="space-y-2 py-2">
									<Label for="pattern-bulk-tags">追加するタグ</Label>
									<Input
										id="pattern-bulk-tags"
										onInput={(event) => setModalTags(event.currentTarget.value)}
										placeholder="タグを入力…"
										value={modalTags()}
									/>
								</div>
								<DialogFooter>
									<Button onClick={requestModalClose} variant="outline">
										キャンセル
									</Button>
									<Button
										class="bg-[#08766a] hover:bg-[#06645a]"
										onClick={closeModal}
									>
										12件に適用
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</PatternCard>

					<PatternCard
						description="メディア情報や関連付けなど、一覧を見ながら続けたい長めの編集。内部だけが縦スクロールします。"
						label="CONTEXTUAL / MODAL"
						title="Drawer"
					>
						<Dialog onOpenChange={handleDrawerOpenChange} open={drawerOpen()}>
							<DialogTrigger
								class={buttonVariants({
									class: "w-full border-[#d6dcd8] bg-white shadow-none",
									variant: "outline",
								})}
							>
								詳細編集を開く
							</DialogTrigger>
							<DialogContent
								class="gap-0 bg-[#fbfcfa] p-0"
								onEscapeKeyDown={(event) => {
									if (!isDrawerDirty()) return;
									event.preventDefault();
									setDiscardTarget("drawer");
								}}
								onPointerDownOutside={(event) => {
									if (!isDrawerDirty()) return;
									event.preventDefault();
									setDiscardTarget("drawer");
								}}
								placement="right"
							>
								<DialogHeader class="border-[#e1e5e2] border-b px-5 py-4 pr-12">
									<div class="flex items-center gap-2">
										<DialogTitle class="text-base">
											メディア情報を編集
										</DialogTitle>
										<Show when={isDrawerDirty()}>
											<Badge
												class="border-[#f2d08c] bg-[#fff8e8] text-[#795313]"
												variant="outline"
											>
												未保存
											</Badge>
										</Show>
									</div>
									<DialogDescription>
										一覧の選択状態を保ったまま編集します。
									</DialogDescription>
								</DialogHeader>
								<div class="min-h-0 overflow-y-auto overscroll-contain px-5 py-5">
									<div class="space-y-5">
										<div class="space-y-2">
											<Label for="pattern-description">Description</Label>
											<textarea
												class="min-h-28 w-full resize-y rounded-md border border-[#d9dfdb] bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0b8f80]"
												id="pattern-description"
												onInput={(event) =>
													updateDrawerDraft(
														"description",
														event.currentTarget.value,
													)
												}
												placeholder="説明を入力…"
												value={drawerDraft().description}
											/>
										</div>
										<For each={DRAWER_FIELDS}>
											{(field) => (
												<div class="space-y-2 border-[#e4e8e5] border-t pt-5">
													<Label for={`pattern-${field.key}`}>
														{field.label}
													</Label>
													<Input
														id={`pattern-${field.key}`}
														onInput={(event) =>
															updateDrawerDraft(
																field.key,
																event.currentTarget.value,
															)
														}
														placeholder={`${field.label}を検索…`}
														value={drawerDraft()[field.key]}
													/>
												</div>
											)}
										</For>
									</div>
								</div>
								<DialogFooter class="border-[#e1e5e2] border-t px-5 py-4">
									<Button onClick={requestDrawerClose} variant="outline">
										キャンセル
									</Button>
									<Button
										class="bg-[#08766a] hover:bg-[#06645a]"
										onClick={closeDrawer}
									>
										変更を保存
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
						<AlertDialog
							onOpenChange={(open) => {
								if (!open) setDiscardTarget();
							}}
							open={discardTarget() !== undefined}
						>
							<AlertDialogContent class="border-[#dce2de] bg-[#fbfcfa]">
								<AlertDialogHeader>
									<AlertDialogTitle>変更を破棄しますか？</AlertDialogTitle>
									<AlertDialogDescription>
										入力した内容は保存されていません。この操作は取り消せません。
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel aria-label="編集を続ける">
										編集を続ける
									</AlertDialogCancel>
									<AlertDialogAction
										aria-label="変更を破棄"
										class="bg-[#b43a32] text-white hover:bg-[#982f29]"
										onClick={discardPendingChanges}
									>
										変更を破棄
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</PatternCard>
				</div>

				<section class="mt-6 rounded-lg border border-[#dde3df] bg-white">
					<div class="flex flex-wrap items-start justify-between gap-3 border-[#e1e5e2] border-b px-5 py-4">
						<div>
							<p class="font-medium text-[#08766a] text-[11px] tracking-wide">
								STATUS / NON-MODAL
							</p>
							<h2 class="mt-1 font-semibold text-[#2a302d] text-sm">Toast</h2>
							<p class="mt-1 max-w-2xl text-[#68706c] text-xs leading-5">
								作業を止めずに結果を知らせます。次の操作が必要な時だけ、短いアクションを1つ添えます。
							</p>
						</div>
						<span class="rounded-full bg-[#f1f4f2] px-2.5 py-1 text-[#66706b] text-[11px]">
							右上に最大4件
						</span>
					</div>
					<div class="grid gap-px bg-[#e6eae7] sm:grid-cols-2 xl:grid-cols-4">
						<div class="flex min-w-0 flex-col gap-3 bg-white p-4">
							<div class="flex items-start gap-3">
								<CircleCheck
									aria-hidden="true"
									class="mt-0.5 shrink-0 text-[#08766a]"
									size={16}
								/>
								<div>
									<h3 class="font-medium text-[#343b37] text-xs">成功</h3>
									<p class="mt-1 text-[#68706c] text-xs leading-5">
										確認だけでよい結果。4秒で閉じます。
									</p>
								</div>
							</div>
							<Button
								class="mt-auto w-full"
								onClick={showSuccessToast}
								size="sm"
								variant="outline"
							>
								成功を表示
							</Button>
						</div>
						<div class="flex min-w-0 flex-col gap-3 bg-white p-4">
							<div class="flex items-start gap-3">
								<Clock3
									aria-hidden="true"
									class="mt-0.5 shrink-0 text-[#426d86]"
									size={16}
								/>
								<div>
									<h3 class="font-medium text-[#343b37] text-xs">Job投入</h3>
									<p class="mt-1 text-[#68706c] text-xs leading-5">
										処理先への導線を1つだけ表示します。
									</p>
								</div>
							</div>
							<Button
								class="mt-auto w-full"
								onClick={showJobToast}
								size="sm"
								variant="outline"
							>
								Job通知を表示
							</Button>
						</div>
						<div class="flex min-w-0 flex-col gap-3 bg-white p-4">
							<div class="flex items-start gap-3">
								<CircleAlert
									aria-hidden="true"
									class="mt-0.5 shrink-0 text-[#a66b12]"
									size={16}
								/>
								<div>
									<h3 class="font-medium text-[#343b37] text-xs">警告</h3>
									<p class="mt-1 text-[#68706c] text-xs leading-5">
										継続可能な問題と復旧操作を示します。
									</p>
								</div>
							</div>
							<Button
								class="mt-auto w-full"
								onClick={showWarningToast}
								size="sm"
								variant="outline"
							>
								警告を表示
							</Button>
						</div>
						<div class="flex min-w-0 flex-col gap-3 bg-white p-4">
							<div class="flex items-start gap-3">
								<Ban
									aria-hidden="true"
									class="mt-0.5 shrink-0 text-[#b43a32]"
									size={16}
								/>
								<div>
									<h3 class="font-medium text-[#343b37] text-xs">失敗</h3>
									<p class="mt-1 text-[#68706c] text-xs leading-5">
										原因と再試行を示し、少し長く残します。
									</p>
								</div>
							</div>
							<Button
								class="mt-auto w-full"
								onClick={showErrorToast}
								size="sm"
								variant="outline"
							>
								失敗を表示
							</Button>
						</div>
					</div>
				</section>

				<section class="mt-6 rounded-lg border border-[#dde3df] bg-white">
					<div class="border-[#e1e5e2] border-b px-5 py-4">
						<h2 class="font-semibold text-[#2a302d] text-sm">共通の閉じ方</h2>
					</div>
					<dl class="grid gap-px bg-[#e6eae7] sm:grid-cols-3">
						<div class="bg-white p-4">
							<dt class="font-medium text-[#38403c] text-xs">Escape</dt>
							<dd class="mt-1 text-[#68706c] text-xs leading-5">
								未変更なら閉じる・変更済みなら破棄確認
							</dd>
						</div>
						<div class="bg-white p-4">
							<dt class="font-medium text-[#38403c] text-xs">外側クリック</dt>
							<dd class="mt-1 text-[#68706c] text-xs leading-5">
								未変更なら閉じる・変更済みなら破棄確認
							</dd>
						</div>
						<div class="bg-white p-4">
							<dt class="font-medium text-[#38403c] text-xs">フォーカス</dt>
							<dd class="mt-1 text-[#68706c] text-xs leading-5">
								閉じたら起点のボタンへ戻す
							</dd>
						</div>
					</dl>
				</section>
			</div>
		</section>
	);
}

export function DesignConceptScreen() {
	const [activeView, setActiveView] = createSignal<DesignLabView>("library");
	const [isImportInboxOpen, setIsImportInboxOpen] = createSignal(false);
	const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
	const [selectedId, setSelectedId] = createSignal(MOCK_MEDIA[0].id);
	const [selectedSourceId, setSelectedSourceId] = createSignal("all");
	const [mode, setMode] = createSignal<SearchMode>("simple");
	const [draft, setDraft] = createSignal("");
	const shellGridColumns = createMemo(() => {
		if (activeView() === "library") {
			return sidebarExpanded()
				? "grid-cols-[64px_minmax(0,1fr)] xl:grid-cols-[216px_minmax(0,1fr)] 2xl:grid-cols-[216px_minmax(0,1fr)_clamp(20rem,26vw,26rem)]"
				: "grid-cols-[64px_minmax(0,1fr)] 2xl:grid-cols-[64px_minmax(0,1fr)_clamp(20rem,26vw,26rem)]";
		}
		return sidebarExpanded()
			? "grid-cols-[64px_minmax(0,1fr)] xl:grid-cols-[216px_minmax(0,1fr)]"
			: "grid-cols-[64px_minmax(0,1fr)]";
	});
	const [filters, setFilters] = createStore<DesignFilterState>({
		searchQuery: "",
		selectedIps: [],
		selectedCharacters: [],
		selectedTags: ["scenery", "summer"],
		excludeTags: ["R18"],
		selectedAuthors: [],
		selectedProjects: [],
	});
	const selectedMedia = () =>
		MOCK_MEDIA.find((media) => media.id === selectedId()) ?? MOCK_MEDIA[0];
	const selectAdjacentMedia = (offset: -1 | 1) => {
		const currentIndex = MOCK_MEDIA.findIndex(
			(media) => media.id === selectedId(),
		);
		const nextIndex =
			(currentIndex + offset + MOCK_MEDIA.length) % MOCK_MEDIA.length;
		setSelectedId(MOCK_MEDIA[nextIndex].id);
	};
	const selectedSource = () =>
		MOCK_SOURCES.find((source) => source.id === selectedSourceId());
	const selectedSourceName = () => selectedSource()?.name ?? "All Media";
	const selectedSourceCount = () => selectedSource()?.count ?? 1248;
	const filterTokens = createMemo<FilterToken[]>(() => {
		const tokens: FilterToken[] = [];
		if (filters.searchQuery) {
			tokens.push({
				id: `searchQuery:${filters.searchQuery}`,
				key: "searchQuery",
				prefix: "name",
				value: filters.searchQuery,
			});
		}
		for (const field of FILTER_FIELDS) {
			for (const value of filters[field.key]) {
				tokens.push({
					destructive: field.key === "excludeTags",
					id: `${field.key}:${value}`,
					key: field.key,
					prefix: field.prefix,
					value,
				});
			}
		}
		return tokens;
	});
	const setFilterValues = (key: FilterArrayKey, values: string[]) => {
		setFilters(key, [...new Set(values)]);
	};
	const addFilterValues = (key: FilterArrayKey, rawValue: string) => {
		const values = parseFilterValues(rawValue);
		if (values.length === 0) return;
		setFilters(key, [...new Set([...filters[key], ...values])]);
	};
	const removeFilterToken = (token: FilterToken) => {
		if (token.key === "searchQuery") {
			setFilters("searchQuery", "");
			return;
		}
		setFilters(
			token.key,
			filters[token.key].filter((value) => value !== token.value),
		);
	};
	const clearFilters = () => {
		setFilters({
			searchQuery: "",
			selectedIps: [],
			selectedCharacters: [],
			selectedTags: [],
			excludeTags: [],
			selectedAuthors: [],
			selectedProjects: [],
		});
	};
	const submitDraft = () => {
		const parts = draft().match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
		const freeText: string[] = [];

		for (const part of parts) {
			const separatorIndex = part.indexOf(":");
			if (separatorIndex < 1) {
				freeText.push(part);
				continue;
			}

			const prefix = part.slice(0, separatorIndex).toLowerCase();
			const value = part
				.slice(separatorIndex + 1)
				.replace(/^"|"$/g, "")
				.trim();
			if (!value) continue;

			switch (prefix) {
				case "name":
					setFilters("searchQuery", value);
					break;
				case "tag":
					addFilterValues("selectedTags", value);
					break;
				case "-tag":
					addFilterValues("excludeTags", value);
					break;
				case "ip":
					addFilterValues("selectedIps", value);
					break;
				case "character":
					addFilterValues("selectedCharacters", value);
					break;
				case "author":
					addFilterValues("selectedAuthors", value);
					break;
				case "project":
					addFilterValues("selectedProjects", value);
					break;
				default:
					freeText.push(part);
			}
		}

		if (freeText.length > 0) {
			setFilters("searchQuery", freeText.join(" "));
		}
		setDraft("");
	};

	return (
		<main
			class={`grid h-[100dvh] overflow-hidden bg-[#fafbf9] font-sans text-[#242927] transition-[grid-template-columns] duration-150 motion-reduce:transition-none ${shellGridColumns()}`}
			data-design-lab
		>
			<DesignSidebar
				activeView={activeView()}
				expanded={sidebarExpanded()}
				inboxCount={MOCK_IMPORT_POSTS.length}
				onExpandedChange={setSidebarExpanded}
				onInboxOpen={() => setIsImportInboxOpen(true)}
				onSourceChange={setSelectedSourceId}
				onViewChange={setActiveView}
				selectedSourceId={selectedSourceId()}
			/>

			<Show
				fallback={
					activeView() === "detail" ? (
						<DesignMediaDetailScreen
							media={selectedMedia()}
							onBack={() => setActiveView("library")}
							onNext={() => selectAdjacentMedia(1)}
							onPrevious={() => selectAdjacentMedia(-1)}
						/>
					) : activeView() === "overlays" ? (
						<OverlayPatternsScreen onOpenJobs={() => setActiveView("jobs")} />
					) : activeView() === "layouts" ? (
						<ScreenLayoutsScreen />
					) : activeView() === "manager" ? (
						<DesignManagerScreen />
					) : activeView() === "jobs" ? (
						<JobsScreen />
					) : activeView() === "settings" ? (
						<SettingsScreen />
					) : (
						<InteractionPatternsScreen />
					)
				}
				when={activeView() === "library"}
			>
				<section class="flex min-h-0 min-w-0 flex-col bg-[#fafbf9]">
					<DesignToolbar
						draft={draft()}
						filterTokens={filterTokens()}
						filters={filters}
						mode={mode()}
						onClearFilters={clearFilters}
						onDraftChange={setDraft}
						onDraftSubmit={submitDraft}
						onModeChange={setMode}
						onRemoveToken={removeFilterToken}
						onValuesChange={setFilterValues}
						sourceName={selectedSourceName()}
					/>
					<div class="flex items-center justify-between px-4 pt-3 pb-2 text-xs">
						<p class="text-[#5f6763]">
							{selectedSourceCount().toLocaleString()} items
						</p>
						<p class="hidden text-[#68706c] sm:block">
							Design lab ・ mock data
						</p>
					</div>
					<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-gutter:stable]">
						<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
							<For each={MOCK_MEDIA}>
								{(media) => (
									<MediaTile
										media={media}
										onSelect={() => setSelectedId(media.id)}
										selected={selectedId() === media.id}
									/>
								)}
							</For>
						</div>
					</div>
				</section>

				<div class="hidden min-h-0 2xl:block">
					<DesignInspector
						media={selectedMedia()}
						onOpenDetail={() => setActiveView("detail")}
					/>
				</div>
			</Show>

			<ImportInboxDialog
				onOpenChange={setIsImportInboxOpen}
				open={isImportInboxOpen()}
			/>
		</main>
	);
}
