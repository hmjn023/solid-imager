type PopupSide = "top" | "bottom" | "left" | "right";
type PopupAlign = "start" | "center" | "end";

export type PopupPlacement = PopupSide | `${PopupSide}-${PopupAlign}`;

export function popupSide(
	placement: PopupPlacement | undefined,
): PopupSide | undefined {
	if (placement?.startsWith("top")) return "top";
	if (placement?.startsWith("bottom")) return "bottom";
	if (placement?.startsWith("left")) return "left";
	if (placement?.startsWith("right")) return "right";
}

export function popupAlign(
	placement: PopupPlacement | undefined,
): PopupAlign | undefined {
	if (placement?.endsWith("-start")) return "start";
	if (placement?.endsWith("-end")) return "end";
	if (placement) return "center";
}
