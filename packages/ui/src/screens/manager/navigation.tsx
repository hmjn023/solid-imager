import { t } from "@solid-imager/i18n";
import ArrowDownUp from "@lucide/solid/icons/arrow-down-up";
import Bot from "@lucide/solid/icons/bot";
import CopyCheck from "@lucide/solid/icons/copy-check";
import Folder from "@lucide/solid/icons/folder";
import Image from "@lucide/solid/icons/image";
import Library from "@lucide/solid/icons/library";
import ScanFace from "@lucide/solid/icons/scan-face";
import Tags from "@lucide/solid/icons/tags";
import UserRound from "@lucide/solid/icons/user-round";
import { For } from "solid-js";
import { Binary, Sparkles } from "../../workspace/icons";
import {
	CategoryLabel,
	MANAGEMENT_CATEGORY_LIST,
	CompactCategorySelect,
	categoryButtonClass,
} from "../../workspace/management-layout";
import { MANAGER_CATEGORIES, type ManagerCategoryValue } from "./types";

function ManagerCategoryIcon(props: { value: ManagerCategoryValue }) {
	switch (props.value) {
		case "projects":
			return <Folder aria-hidden="true" size={16} />;
		case "ips":
			return <Library aria-hidden="true" size={16} />;
		case "authors":
			return <UserRound aria-hidden="true" size={16} />;
		case "characters":
			return <ScanFace aria-hidden="true" size={16} />;
		case "tagging":
			return <Bot aria-hidden="true" size={16} />;
		case "tagDictionary":
			return <Tags aria-hidden="true" size={16} />;
		case "vectors":
			return <Binary aria-hidden="true" size={16} />;
		case "clustering":
			return <Sparkles aria-hidden="true" size={16} />;
		case "thumbnails":
			return <Image aria-hidden="true" size={16} />;
		case "duplicates":
			return <CopyCheck aria-hidden="true" size={16} />;
		case "transfer":
			return <ArrowDownUp aria-hidden="true" size={16} />;
	}
}

export function ManagerCategoryNavigation(props: {
	active: ManagerCategoryValue;
	compact?: boolean;
	onChange: (value: ManagerCategoryValue) => void;
}) {
	if (props.compact) {
		return (
			<nav aria-label={t("navigation.managerCategories")}>
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
		<nav
			aria-label={t("navigation.managerCategories")}
			class={`${MANAGEMENT_CATEGORY_LIST} lg:block`}
		>
			<div class="space-y-5">
				<For each={["Entities", "Tools"] as const}>
					{(group) => (
						<div>
							<p class="mb-1 px-2.5 font-medium text-label-xs uppercase tracking-wider text-muted-foreground">
								{group === "Entities"
									? t("manager.entitiesGroup")
									: t("manager.toolsGroup")}
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
