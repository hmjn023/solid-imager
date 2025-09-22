import * as AlertDialogPrimitive from "@kobalte/core/alert-dialog";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import type { Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import { splitProps } from "solid-js";

import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal: Component<AlertDialogPrimitive.AlertDialogPortalProps> = (props) => {
  const [, rest] = splitProps(props, ["children"]);
  return (
    <AlertDialogPrimitive.Portal {...rest}>
      <div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
        {props.children}
      </div>
    </AlertDialogPrimitive.Portal>
  );
};

type AlertDialogOverlayProps<T extends ValidComponent = "div"> =
  AlertDialogPrimitive.AlertDialogOverlayProps<T> & { class?: string | undefined };

const AlertDialogOverlay = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, AlertDialogOverlayProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogOverlayProps, ["class"]);
  return (
    <AlertDialogPrimitive.Overlay
      class={cn(
        "fixed inset-0 z-50 bg-background/80 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0",
        props.class
      )}
      {...rest}
    />
  );
};

type AlertDialogContentProps<T extends ValidComponent = "div"> =
  AlertDialogPrimitive.AlertDialogContentProps<T> & {
    class?: string | undefined;
    children?: JSX.Element;
  };

const AlertDialogContent = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, AlertDialogContentProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogContentProps, ["class", "children"]);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        class={cn(
          "fixed left-1/2 top-1/2 z-50 grid max-h-screen w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] sm:rounded-lg",
          props.class
        )}
        {...rest}
      >
        {props.children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return <div class={cn("flex flex-col space-y-2 text-center sm:text-left", props.class)} {...rest} />;
};

const AlertDialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <div class={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", props.class)} {...rest} />
  );
};

type AlertDialogTitleProps<T extends ValidComponent = "h2"> =
  AlertDialogPrimitive.AlertDialogTitleProps<T> & {
    class?: string | undefined;
  };

const AlertDialogTitle = <T extends ValidComponent = "h2">(
  props: PolymorphicProps<T, AlertDialogTitleProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogTitleProps, ["class"]);
  return <AlertDialogPrimitive.Title class={cn("text-lg font-semibold", props.class)} {...rest} />;
};

type AlertDialogDescriptionProps<T extends ValidComponent = "p"> =
  AlertDialogPrimitive.AlertDialogDescriptionProps<T> & {
    class?: string | undefined;
  };

const AlertDialogDescription = <T extends ValidComponent = "p">(
  props: PolymorphicProps<T, AlertDialogDescriptionProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogDescriptionProps, ["class"]);
  return <AlertDialogPrimitive.Description class={cn("text-sm text-muted-foreground", props.class)} {...rest} />;
};

type AlertDialogActionProps<T extends ValidComponent = "button"> =
  AlertDialogPrimitive.AlertDialogActionButtonProps<T> & {
    class?: string | undefined;
  };

const AlertDialogAction = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, AlertDialogActionProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogActionProps, ["class"]);
  return <AlertDialogPrimitive.ActionButton class={cn(buttonVariants(), props.class)} {...rest} />;
};

type AlertDialogCancelProps<T extends ValidComponent = "button"> =
  AlertDialogPrimitive.AlertDialogCancelButtonProps<T> & {
    class?: string | undefined;
  };

const AlertDialogCancel = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, AlertDialogCancelProps<T>>
) => {
  const [, rest] = splitProps(props as AlertDialogCancelProps, ["class"]);
  return (
    <AlertDialogPrimitive.CancelButton
      class={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", props.class)}
      {...rest}
    />
  );
};


export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
