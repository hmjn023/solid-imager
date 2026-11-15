import { changeLocale, getLocale, type Locale, t } from "@solid-imager/i18n";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./select";
import { toast } from "./toast";

const LOCALES: Locale[] = ["ja", "en"];
const languageName = (locale: Locale) =>
	t(locale === "ja" ? "locale.japanese" : "locale.english");

/** A device preference, separate from server configuration. */
export function LanguageSettings(props: { disabled?: boolean }) {
	const chooseLanguage = (locale: Locale | null) => {
		if (props.disabled || !locale || locale === getLocale()) return;
		try {
			changeLocale(locale);
		} catch {
			toast.error(t("locale.saveFailed"));
		}
	};
	return (
		<section class="space-y-2">
			<Select<Locale>
				options={LOCALES}
				disabled={props.disabled}
				value={getLocale()}
				onChange={chooseLanguage}
				itemComponent={(props) => (
					<SelectItem item={props.item}>
						<span lang={props.item.rawValue}>
							{languageName(props.item.rawValue)}
						</span>
					</SelectItem>
				)}
			>
				<SelectLabel id="display-language-label">
					{t("locale.title")}
				</SelectLabel>
				<SelectTrigger
					id="display-language"
					aria-labelledby="display-language-label"
					aria-describedby="display-language-hint"
					class="max-w-72"
				>
					<SelectValue<Locale>>
						{(state) => (
							<span lang={state.selectedOption()}>
								{languageName(state.selectedOption())}
							</span>
						)}
					</SelectValue>
				</SelectTrigger>
				<SelectContent />
			</Select>
			<p id="display-language-hint" class="text-xs text-muted-foreground">
				{t(props.disabled ? "locale.saveChangesFirst" : "locale.hint")}
			</p>
		</section>
	);
}
