---
version: "alpha"
name: "Solid Imager"
description: "A calm, dense, media-first workspace for searching, reviewing, and managing large image libraries."
colors:
  primary: "#08766A"
  primary-hover: "#06645A"
  focus: "#0B8F80"
  on-primary: "#FFFFFF"
  canvas: "#FAFBF9"
  surface: "#FFFFFF"
  surface-subtle: "#FBFCFA"
  surface-muted: "#F1F4F2"
  surface-selected: "#E1F1ED"
  border: "#E1E5E2"
  border-strong: "#D9DFDB"
  text: "#202624"
  text-secondary: "#59615D"
  text-muted: "#68706C"
  destructive: "#B43A32"
  destructive-hover: "#982F29"
  warning: "#795313"
  warning-surface: "#FFF8E8"
  info: "#426D86"
  info-surface: "#EEF6FA"
typography:
  page-title:
    fontFamily: "system-ui"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.01em"
  section-title:
    fontFamily: "system-ui"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "system-ui"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.375rem"
  label:
    fontFamily: "system-ui"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  metadata:
    fontFamily: "system-ui"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  app-shell:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
  sidebar:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    width: "216px"
    padding: "{spacing.sm}"
  sidebar-collapsed:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    width: "64px"
    padding: "{spacing.sm}"
  nav-item-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "40px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    height: "36px"
  button-destructive-hover:
    backgroundColor: "{colors.destructive-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  focus-indicator:
    backgroundColor: "{colors.focus}"
    rounded: "{rounded.sm}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  muted-badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.metadata}"
    rounded: "{rounded.pill}"
  secondary-copy:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.text}"
    height: "1px"
  input-border:
    backgroundColor: "{colors.border-strong}"
    textColor: "{colors.text}"
    height: "1px"
  status-warning:
    backgroundColor: "{colors.warning-surface}"
    textColor: "{colors.warning}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  status-info:
    backgroundColor: "{colors.info-surface}"
    textColor: "{colors.info}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  toast:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    width: "24rem"
---

## Overview

Solid Imager is a workbench, not a marketing site. Its visual character is calm,
compact, and media-first: the image collection receives the available area while
navigation and metadata remain immediately reachable without competing with it.

Three sources define the system, in this order:

1. The tokens in this file are the normative visual values.
2. The guidance below defines why and when those values are used.
3. `/design-lab` is the executable reference for layout and interaction behavior.

Use the shared components in `packages/ui` and continue to source primitives from
Solid UI. The design lab may compose those primitives, but must not create a
parallel component library. The lab is a migration reference; it is not evidence
that a mocked concept such as accounts or a dedicated route must exist in the
product. Controls that only demonstrate a visual state in the lab are not an API or
feature contract until the corresponding product behavior is implemented.

The governing principles are:

- **Media first:** use the viewport for media or actionable data, not decorative
  framing.
- **Dense, not cramped:** prefer 8–16px internal spacing and clear separators over
  oversized cards and empty margins.
- **One task, one obvious place:** Sources live in the sidebar, background work in
  Jobs, imports in the inbox, and data transfer under Manager tools.
- **Stable context:** preserve source, filters, selection, and scroll position when
  moving between a collection and an item. Route-specific data must always follow
  the current route ID.
- **Progressive detail:** keep frequent actions visible and move secondary actions
  into popovers, drawers, or “More actions”.

## Colors

The palette is built from warm near-whites, charcoal text, quiet green-gray
borders, and one teal interaction color. It should feel closer to a focused desktop
tool than a colorful dashboard.

- `primary` marks the current location, primary actions, selected media, and
  successful completion. `primary-hover` is reserved for hover/pressed states.
- `focus` is the keyboard focus ring. Do not replace it with a colorless outline.
- `canvas` is the main workspace; `surface` is an interactive panel; and
  `surface-subtle` separates persistent regions such as the sidebar and inspector.
- `surface-selected` is the only large-area selection tint. Selection must also use
  an icon, ring, `aria-current`, or `aria-pressed` rather than color alone.
- `border` separates regions; `border-strong` defines controls. The `divider` and
  `input-border` component tokens represent one-pixel strokes, not filled surfaces.
- `text` is for headings and primary values. `text-secondary` is for labels and
  metadata. `text-muted` remains WCAG AA compliant for small helper text.
- `destructive` is only for irreversible or failed actions. Warnings and information
  use their dedicated foreground/surface pairs and must not borrow destructive red.

Avoid broad gradients, tinted page backgrounds, and arbitrary accent colors. A
black-to-transparent gradient is allowed only as a thumbnail text scrim. Do not add
a gray frame behind a full-size media preview; the preview itself should use the
available surface.

The current production theme and design-lab prototype predate this canonical
palette: the theme still contains a zinc/black primary while parts of the lab use
nearby colors inline. During migration, map the tokens above to shared CSS variables
first. Do not copy the lab's one-off hex values into production components.

## Typography

Use the operating-system sans-serif stack so Japanese and Latin text render
consistently without a remote font dependency. Typography creates hierarchy with
weight and spacing, not dramatic size jumps.

- Page titles use `page-title` (20px/600).
- Card and inspector titles use `section-title` (16px/600).
- Controls and ordinary content use `body` (14px).
- Form labels and secondary table data use `label` (12px).
- Badges, counts, file extensions, and compact status text use `metadata` (11px).

Prefer sentence case. Use all caps only for very small design-lab taxonomy labels,
never for ordinary navigation or actions. Filenames and identifiers may wrap or
truncate according to context, but they must expose the full value through the
detail view or an accessible name. A production control group uses one active
locale; do not mix Japanese and English labels inside the same workflow. Explanatory
copy in the design lab may remain Japanese while product localization is undecided.

## Layout

### Application shell

The application fills `100dvh`. The expanded sidebar is 216px; its collapsed rail
is 64px. The collapse control appears next to “Solid Imager” on hover or keyboard
focus and remains visible in the collapsed state. Main content is always
`min-width: 0` so it can shrink without forcing page-level horizontal scrolling.

Each page has one vertical scroll owner. Persistent headers, sidebars, inspectors,
and action footers stay outside that scroll region. Use `overscroll-contain` and
`scrollbar-gutter: stable` for nested work areas; never rely on scrolling the body
to reveal content hidden inside another scroll container.

### Four screen archetypes

1. **Collection:** search/toolbar at the top, responsive media grid in the center,
   and an inspector only when it has enough width to be useful.
2. **Detail:** edge-to-edge media preview plus a metadata inspector. On a narrow
   viewport the inspector stacks below the preview at full width.
3. **Management:** full-width list or table with compact filters; a selected-row
   inspector appears only on wide layouts.
4. **Settings:** categories sit at the far left and the editor grows horizontally.
   Do not center the form in a narrow decorative column.

### Collection and loading behavior

The media grid uses the same responsive rule for content and loading placeholders:
between 2 and 8 columns according to the grid container, not a fixed three-column
cap. When the result count is known, render the matching number of placeholders.
When it is not known, fill the visible grid area rather than showing a hard-coded
four-item skeleton. Loading and loaded states must not visibly change column count.

A collection inspector preview must be at least as large as one grid tile. On
smaller viewports, omit the inspector and open detail or a drawer instead of
showing a token preview that consumes space without adding information.

### Detail behavior

At desktop widths, the detail view assigns all remaining width and height to the
media and uses a roughly 22rem inspector. The image uses `object-contain`, carries
no decorative gray wrapper, and is not constrained by an arbitrary centered max
width. At narrow widths, media and metadata stack and both use the full content
width. Avoid residual overflow that makes a sufficiently large viewport scroll by
a few pixels.

### Responsive behavior

Reflow before clipping. Controls may wrap into an additional row, category tabs may
scroll horizontally on small screens, and inspectors may disappear or stack. Do
not retain desktop max-widths that create unused vertical-screen gutters. Touch
targets are at least 44px on narrow viewports; desktop controls may use the compact
36px height. Use the Tailwind breakpoints already adopted by the application
(640/768/1024/1280/1536px) and add container-based thresholds when a component's
available width, rather than the viewport, controls its layout.

## Elevation & Depth

The interface is primarily flat. One-pixel borders, background changes, and spacing
create hierarchy. Ordinary cards use at most a subtle `0 1px 2px` shadow; never
stack multiple framed cards merely to separate sections.

Strong shadows are reserved for content that floats over the work area: popovers,
modals, drawers, and toasts. A centered modal scales/fades around its final center.
A right drawer enters from and exits toward the right edge. Its origin and final
position must not drift during animation. Disable nonessential transforms and
transitions under `prefers-reduced-motion: reduce`.

## Shapes

Use 6px rounding for controls, 8px for panels and overlays, and 4px for small
internal elements. Pills are reserved for statuses, counts, and removable search
tokens. Media thumbnails use 6px rounding; the full-size media preview itself does
not need a card silhouette.

Avoid exaggerated rounding, floating “islands”, or nested rounded containers. A
shape should communicate a boundary or interaction, not decorate empty space.

## Components

### Sidebar and navigation

- Primary destinations are Library, Media Detail when contextually relevant,
  Manager, Jobs, and Settings.
- Search remains globally discoverable from the sidebar and collection toolbar.
- Sources are a collapsible sidebar section, not a dedicated full-screen route.
  Show connection/sync status and media count beside each source.
- Import inbox is a sidebar icon with its pending count. It opens a review modal
  where users choose a destination source and select or discard incoming posts.
- Jobs shows an active/failed count badge. Collapsed navigation retains compact
  badges and accessible labels.

The import inbox opens a focused modal rather than a full page. It provides the
destination source, selected count, Select/Clear all, Delete, and Import actions.
Incoming post cards use 2 columns on the narrowest layout, then 3 and 4 as space
allows; the modal may grow to roughly 64rem but keeps its header and footer visible.

### Search composer

The collection uses one growing search composer that combines free text and
removable tokens. Supported prefixes are `name:`, `tag:`, `-tag:`, `character:`,
`ip:`, `author:`, and `project:`; comma-separated values are allowed where the
underlying filter supports multiple values. Display at most four tokens inline and
collapse the remainder into a count.

The filter popover edits the same state as the composer. “Simple” exposes frequent
fields, “Detailed” opens the full condition builder, and “Similar” shows the vector
source and result limit. These modes must not create competing stores or remount an
input on every keystroke. Search focus and cursor position remain stable while
typing.

### Buttons, inputs, and asynchronous actions

Primary buttons represent one preferred next action per region. Secondary buttons
use a white surface and strong border. Destructive styling is reserved for the
specific destructive action, not the whole footer.

Disable an asynchronous trigger while its request is pending to prevent duplicate
jobs. Keep the label width stable where practical, expose progress with a polite
live region, and provide completion feedback outside the button. Long-running work
belongs in Jobs rather than keeping a modal open.

### Collection and detail

Media tiles use a 4:3 collection aspect ratio unless source content requires a
specific view. Hover/focus may reveal filename and extension; selection adds a teal
ring and check indicator. Opening an item preserves collection source, filters,
selected item, and scroll position. Browser Back restores that context. Opening a
different route UUID must update the preview and sidebar immediately; cached blob
URLs are never the identity of the route.

The detail header keeps Back, previous/next, and the two most frequent actions
visible. Secondary AI, vector, download, and destructive operations belong under
“More actions”. Metadata is grouped into Description, Relations, Tags, and File
information without wrapping the media in an extra card.

### Popover, modal, drawer, and confirmation

- **Popover:** lightweight, non-modal settings that apply in place. The underlying
  collection remains interactive.
- **Modal:** a short, focused task requiring completion before returning. It opens
  and closes around the same centered position and stays within the safe-area-aware
  viewport height.
- **Drawer:** longer contextual editing while retaining awareness of the list. It
  is right-aligned, owns its internal scroll area, keeps its footer visible, and is
  at most 28rem wide.
- **Discard confirmation:** Escape and outside click close a clean overlay. If an
  overlay contains unsaved changes, both actions open a discard confirmation
  instead. Closing returns focus to the trigger.

### Toasts and status

Toasts appear at the top right, with a maximum of four visible notifications and an
explicit close button. Use a 20px desktop offset and 10px stack gap. On narrow
screens they use the available width with 12px side offsets. They never
light-dismiss when another area is clicked.

- Success is confirmation-only and normally closes after about four seconds.
- Job submission stays for about seven seconds and offers one action: “View Jobs”.
- Warning stays for about eight seconds, explains a recoverable condition, and may
  offer one recovery action.
- Error names the failed operation, stays for about nine seconds, and may offer
  Retry.

Do not report continuous batch progress through repeated toasts. Send the work to
Jobs, use a single submission toast, and update the Jobs view through live events.

### Manager, tools, jobs, and settings

Manager uses compact tables for IPs, Characters, and Projects, with a wide-screen
selection inspector. Duplicate detection, AI tagging, and vector extraction are
tools that submit Jobs. Export and restore replace the legacy dump-oriented UI and
live under a Data transfer tool.

Jobs is the canonical view for queued, running, failed, and completed background
work. It combines filterable rows with progress, retry/cancel actions, and a
wide-screen inspector. Settings uses a left category tree on desktop, horizontal
category tabs on mobile, full-width field groups, and a sticky save/discard bar only
when the form is dirty.

### Accessibility and interaction state

All icon-only controls require an accessible name. Use native buttons and form
labels, `aria-current` for navigation, `aria-pressed` for selection/toggles, and
polite live regions for asynchronous feedback. Keyboard focus is always visible.
Overlays trap focus appropriately and restore it to their trigger.

Preserve route and collection state deliberately, but never preserve stale entity
data across a route ID change. Direct navigation, reload, client navigation, and
browser Back must render the same item or source.

## Do's and Don'ts

### Do

- Consult this file before changing shared UI, then compare the result in
  `/design-lab` at wide and narrow viewports.
- Reuse Solid UI primitives and promote recurring compositions into `packages/ui`.
- Give each region one scroll owner and verify direct navigation, reload, and Back.
- Use the shared spacing, radius, type, and color values instead of introducing a
  nearby one-off value.
- Use available area for media, tables, and forms; let wide screens become useful.
- Match skeleton count and grid geometry to the loaded collection.
- Validate this file with `bun run design:lint` after changing tokens or guidance.

### Don't

- Do not cap the media grid at three columns or show a fixed four-item loading state.
- Do not create a separate Sources screen while the sidebar hierarchy is sufficient.
- Do not revive separate dump screens; use Manager → Data transfer and Jobs.
- Do not make an inspector preview smaller than the tile it is meant to clarify.
- Do not add gray image frames, decorative cards, or centered max-width wrappers
  that waste an otherwise usable viewport.
- Do not use a toast as a progress monitor or offer multiple competing toast actions.
- Do not silently close dirty modals or drawers on Escape or outside click.
- Do not add account/profile UI until the product has an account concept.
- Do not hard-code a new visual value without first deciding whether it belongs in
  the token set above.
