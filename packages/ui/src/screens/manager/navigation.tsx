import { t } from "@solid-imager/i18n";
import Bot from "lucide-solid/icons/bot";
import CopyCheck from "lucide-solid/icons/copy-check";
import Folder from "lucide-solid/icons/folder";
import Image from "lucide-solid/icons/image";
import Share2 from "lucide-solid/icons/share-2";
import Tags from "lucide-solid/icons/tags";
import { For } from "solid-js";
import {
	CategoryLabel,
	CompactCategorySelect,
	categoryButtonClass,
} from "../../workspace/management-layout";
import { MANAGER_CATEGORIES, type ManagerCategoryValue } from "./types";

function ManagerCategoryIcon(props: { value: ManagerCategoryValue }) {
	switch (props.value) {
		case "projects":
			return <Folder aria-hidden="true" size={16} />;
		case "ips":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "authors":
		case "characters":
			return <Image aria-hidden="true" size={16} />;
		case "tagging":
			return <Bot aria-hidden="true" size={16} />;
		case "tagDictionary":
			return <Tags aria-hidden="true" size={16} />;
		case "vectors":
		case "clustering":
			return <Share2 aria-hidden="true" size={16} />;
		case "thumbnails":
			return <Image aria-hidden="true" size={16} />;
		case "duplicates":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "transfer":
			return <Share2 aria-hidden="true" size={16} />;
	}
}

export function ManagerCategoryNavigation(props: {
	active: ManagerCategoryValue;
	compact?: boolean;
	onChange: (value: ManagerCategoryValue) => void;
}) {
	if (props.compact) {
		return (
			<nav
				aria-label={t("navigation.managerCategories")}
				class="sticky top-0 z-10 border-border border-b bg-background/95 px-3 py-2 backdrop-blur lg:hidden"
			>
				<CompactCategorySelect
					active={props.active}
					label={t("navigation.managerCategories")}
					options={MANAGER_CATEGORIES}
					onChange={props.onChange}
					renderIcon={(category) => (
						<ManagerCategoryIcon value={category.value} />
					)}
				/>
			</nav>
		);
	}

	return (
		<nav aria-label={t("navigation.managerCategories")} class="hidden lg:block">
			<div class="sticky top-5 space-y-5">
				<For each={["Entities", "Tools"] as const}>
					{(group) => (
						<div>
							<p class="mb-1 px-2.5 font-medium text-label-xs uppercase tracking-wider text-muted-foreground">
								{group}
							</p>
							<div class="space-y-0.5">
								<For
									each={MANAGER_CATEGORIES.filter(
										(category) => category.group === group,
									)}
								>
									{(category) => (
										<button
											aria-current={
												props.active === category.value ? "page" : undefined
											}
											class={categoryButtonClass(
												props.active === category.value,
											)}
											onClick={() => props.onChange(category.value)}
											type="button"
										>
											<CategoryLabel
												description={category.description}
												icon={<ManagerCategoryIcon value={category.value} />}
												label={category.label}
											/>
										</button>
									)}
								</For>
							</div>
						</div>
					)}
				</For>
			</div>
		</nav>
	);
}
