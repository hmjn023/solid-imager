import type { en } from "./en";

export type Locale = "ja" | "en";
export type MessageKey = keyof typeof en;
export type MessageParameters<Text extends string> =
	Text extends `${string}{${infer Parameter}}${infer Rest}`
		? Parameter | MessageParameters<Rest>
		: never;

export type MessageArguments<Key extends MessageKey> = [
	MessageParameters<(typeof en)[Key]>,
] extends [never]
	? []
	: [parameters: Record<MessageParameters<(typeof en)[Key]>, string | number>];

/** Checks both dictionary coverage and interpolation names without widening literal types. */
export function defineLocale<
	const Dictionary extends Record<MessageKey, string>,
>(
	dictionary: Dictionary & {
		[Key in MessageKey]: Dictionary[Key] extends ""
			? never
			: [MessageParameters<Dictionary[Key]>] extends [
						MessageParameters<(typeof en)[Key]>,
				  ]
				? [MessageParameters<(typeof en)[Key]>] extends [
						MessageParameters<Dictionary[Key]>,
					]
					? Dictionary[Key]
					: never
				: never;
	} & Record<Exclude<keyof Dictionary, MessageKey>, never>,
): Dictionary {
	return dictionary;
}

export type StaticMessageKey = {
	[Key in MessageKey]: MessageParameters<(typeof en)[Key]> extends never
		? Key
		: never;
}[MessageKey];

/** Preserve literal messages and reject empty source strings at compile time. */
export function defineMessages<const Dictionary extends Record<string, string>>(
	dictionary: Dictionary & {
		[Key in keyof Dictionary]: Dictionary[Key] extends ""
			? never
			: Dictionary[Key];
	},
): Dictionary {
	return dictionary;
}
