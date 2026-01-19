/**
 * Z-index constants for layering UI elements
 * Use these constants instead of hardcoding z-index values
 */

export const Z_INDEX = {
  /** Base layer for normal content */
  base: 0,
  /** Dropdown menus and tooltips */
  dropdown: 10,
  /** Sticky headers and footers */
  sticky: 20,
  /** Overlays and backdrops */
  overlay: 50,
  /** Modal dialogs */
  modal: 60,
  /** Toast notifications */
  toast: 70,
  /** Tooltips that should appear above modals */
  tooltip: 80,
} as const;
