import {
  CloseButton as AlertDialogPrimitiveCloseButton,
  Content as AlertDialogPrimitiveContent,
  Description as AlertDialogPrimitiveDescription,
  Overlay as AlertDialogPrimitiveOverlay,
  Portal as AlertDialogPrimitivePortal,
  Root as AlertDialogPrimitiveRoot,
  Title as AlertDialogPrimitiveTitle,
  Trigger as AlertDialogPrimitiveTrigger,
} from "@kobalte/core/alert-dialog";
import type { Component, ComponentProps } from "solid-js";
import { splitProps } from "solid-js";
import { buttonVariants } from "./button";
import { cn } from "./utils/cn";

const AlertDialog = AlertDialogPrimitiveRoot;
const AlertDialogTrigger = AlertDialogPrimitiveTrigger;

const AlertDialogPortal: Component<
  ComponentProps<typeof AlertDialogPrimitivePortal>
> = (props) => {
  const [, rest] = splitProps(props, ["children"]);
  return (
    <AlertDialogPrimitivePortal {...rest}>
      <div class="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
        {props.children}
      </div>
    </AlertDialogPrimitivePortal>
  );
};

const AlertDialogOverlay: Component<
  ComponentProps<typeof AlertDialogPrimitiveOverlay>
> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <AlertDialogPrimitiveOverlay
      class={cn(
        "data-[closed]:fade-out-0 data-[expanded]:fade-in-0 fixed inset-0 z-50 bg-background/80 data-[closed]:animate-out data-[expanded]:animate-in",
        props.class
      )}
      {...rest}
    />
  );
};

const AlertDialogContent: Component<
  ComponentProps<typeof AlertDialogPrimitiveContent>
> = (props) => {
  const [, rest] = splitProps(props, ["class", "children"]);
  return (
    <AlertDialogPrimitivePortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitiveContent
        class={cn(
          "-translate-x-1/2 -translate-y-1/2 data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95 data-[closed]:slide-out-to-left-1/2 data-[closed]:slide-out-to-top-[48%] data-[expanded]:slide-in-from-left-1/2 data-[expanded]:slide-in-from-top-[48%] fixed top-1/2 left-1/2 z-50 grid max-h-screen w-full max-w-lg gap-4 overflow-y-auto border bg-background p-6 shadow-lg duration-200 data-[closed]:animate-out data-[expanded]:animate-in sm:rounded-lg",
          props.class
        )}
        {...rest}
      >
        {props.children}
      </AlertDialogPrimitiveContent>
    </AlertDialogPrimitivePortal>
  );
};

const AlertDialogHeader: Component<ComponentProps<"div">> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "flex flex-col space-y-2 text-center sm:text-left",
        props.class
      )}
      {...rest}
    />
  );
};

const AlertDialogFooter: Component<ComponentProps<"div">> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <div
      class={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
        props.class
      )}
      {...rest}
    />
  );
};

const AlertDialogTitle: Component<
  ComponentProps<typeof AlertDialogPrimitiveTitle>
> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <AlertDialogPrimitiveTitle
      class={cn("font-semibold text-lg", props.class)}
      {...rest}
    />
  );
};

const AlertDialogDescription: Component<
  ComponentProps<typeof AlertDialogPrimitiveDescription>
> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <AlertDialogPrimitiveDescription
      class={cn("text-muted-foreground text-sm", props.class)}
      {...rest}
    />
  );
};

const AlertDialogAction: Component<
  ComponentProps<typeof AlertDialogPrimitiveCloseButton>
> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <AlertDialogPrimitiveCloseButton
      class={cn(buttonVariants(), props.class)}
      {...rest}
    />
  );
};

const AlertDialogCancel: Component<
  ComponentProps<typeof AlertDialogPrimitiveCloseButton>
> = (props) => {
  const [, rest] = splitProps(props, ["class"]);
  return (
    <AlertDialogPrimitiveCloseButton
      class={cn(
        buttonVariants({ variant: "outline" }),
        "mt-2 sm:mt-0",
        props.class
      )}
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
