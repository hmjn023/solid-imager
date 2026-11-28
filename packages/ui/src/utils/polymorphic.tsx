import {
	dynamic,
	type ComponentProps,
	type ValidComponent,
} from "@solidjs/web";
import { omit } from "solid-js";

export type PolymorphicProps<Tag extends ValidComponent, Props> = Props & {
	as?: Tag;
} & Omit<ComponentProps<Tag>, keyof Props | "as">;

export function Polymorphic<Tag extends ValidComponent>(
	props: ComponentProps<Tag> & { as: Tag },
) {
	const Tag = dynamic(() => props.as);
	return <Tag {...omit(props, "as")} />;
}

export function renderAs(as: () => ValidComponent | undefined) {
	const Tag = dynamic(as);
	return (partProps: Record<string, unknown>) => <Tag {...partProps} />;
}
