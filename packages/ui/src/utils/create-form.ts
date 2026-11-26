import {
	FieldApi,
	FormApi,
	type DeepKeys,
	type FormOptions,
	type FormValidateOrFn,
} from "@tanstack/form-core";
import type { JSX } from "@solidjs/web";
import {
	createEffect,
	createMemo,
	createSignal,
	createUniqueId,
	onSettled,
	untrack,
	type Accessor,
} from "solid-js";

type Options<
	TData,
	TOnChange extends FormValidateOrFn<TData> | undefined,
	TOnSubmit extends FormValidateOrFn<TData> | undefined,
> = FormOptions<
	TData,
	undefined,
	TOnChange,
	undefined,
	undefined,
	undefined,
	TOnSubmit,
	undefined,
	undefined,
	undefined,
	undefined,
	undefined
>;

/** Connects the form core's synchronous store to Solid reads and owner cleanup. */
function subscribeToState<TState>(api: {
	readonly state: TState;
	mount: () => () => void;
	store: { subscribe: (listener: () => void) => { unsubscribe: () => void } };
}): Accessor<TState> {
	const [revision, setRevision] = createSignal(0);
	onSettled(() => {
		const publish = () => setRevision((previous) => previous + 1);
		const subscription = api.store.subscribe(publish);
		const unmount = api.mount();
		publish();
		return () => {
			subscription.unsubscribe();
			unmount();
		};
	});
	return () => {
		revision();
		// Controlled inputs also read the current form store before Solid commits.
		return api.state;
	};
}

export function createForm<
	TData,
	TOnChange extends FormValidateOrFn<TData> | undefined = undefined,
	TOnSubmit extends FormValidateOrFn<TData> | undefined = undefined,
>(options: () => Options<TData, TOnChange, TOnSubmit>) {
	const id = createUniqueId();
	const optionsWithId = () => {
		const input = options();
		return { ...input, formId: input.formId ?? id };
	};
	const api = new FormApi(untrack(optionsWithId));
	const formState = subscribeToState(api);
	createEffect(optionsWithId, api.update);

	const useSelector = <TSelected>(
		selector: (state: typeof api.state) => TSelected,
	) => createMemo(() => selector(formState()));

	const createField = <TName extends DeepKeys<TData>>(name: TName) => {
		const field = new FieldApi({ form: api, name });
		const state = subscribeToState(field);
		return {
			name,
			get state() {
				return state();
			},
			handleBlur: field.handleBlur,
			handleChange: field.handleChange,
		};
	};

	return Object.assign(api, {
		useSelector,
		Subscribe: <TSelected>(props: {
			selector: (state: typeof api.state) => TSelected;
			children: (state: Accessor<NoInfer<TSelected>>) => JSX.Element;
		}) => {
			const selected = useSelector((state) => props.selector(state));
			return untrack(() => props.children(selected));
		},
		Field: <TName extends DeepKeys<TData>>(props: {
			name: TName;
			children: (
				field: Accessor<ReturnType<typeof createField<NoInfer<TName>>>>,
			) => JSX.Element;
		}) => {
			const field = createField(untrack(() => props.name));
			return untrack(() => props.children(() => field));
		},
	});
}
