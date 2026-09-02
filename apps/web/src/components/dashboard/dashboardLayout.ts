import type { DashboardWidgetSize, StoredDashboardLayout } from "../../types/workspace";

export type { DashboardWidgetSize } from "../../types/workspace";

// Every widget the dashboard can show. Order here is only a registry; the default layout
// below decides what a fresh dashboard looks like.
export const DASHBOARD_WIDGET_IDS = [
  "attention",
  "workspace",
  "runtime",
  "resume",
  "chats",
  "automations",
  "shortcuts",
  "favorites"
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export type DashboardWidgetPlacement = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
  hidden: boolean;
};

export type DashboardLayout = {
  version: 1;
  widgets: DashboardWidgetPlacement[];
};

export const DASHBOARD_WIDGET_SIZES: readonly DashboardWidgetSize[] = ["small", "medium", "large"];

// Which formats each widget can take. A list that needs room for a name and a reason
// never goes below medium; a widget that is a handful of numbers never needs large.
export const DASHBOARD_WIDGET_SIZE_OPTIONS: Record<DashboardWidgetId, readonly DashboardWidgetSize[]> = {
  attention: ["medium", "large"],
  workspace: ["small", "medium"],
  runtime: ["small", "medium"],
  resume: ["small", "medium", "large"],
  chats: ["small", "medium", "large"],
  automations: ["small", "medium"],
  shortcuts: ["small", "medium"],
  favorites: ["small", "medium"]
};

// Reading order: what needs me, how the workspace is doing, whether the runtime is up;
// then where to resume (repositories, conversations); then automations and shortcuts.
// Favorites already have a section of their own, so they start hidden and are one click
// away for whoever wants them on the home too.
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  version: 1,
  widgets: [
    { id: "attention", size: "medium", hidden: false },
    { id: "workspace", size: "small", hidden: false },
    { id: "runtime", size: "small", hidden: false },
    { id: "resume", size: "medium", hidden: false },
    { id: "chats", size: "medium", hidden: false },
    { id: "automations", size: "medium", hidden: false },
    { id: "shortcuts", size: "medium", hidden: false },
    { id: "favorites", size: "medium", hidden: true }
  ]
};

// Grid units per size on the four-column desktop grid. Two-column and single-column
// breakpoints clamp these in CSS; the layout model does not know about breakpoints.
export const DASHBOARD_WIDGET_SPANS: Record<DashboardWidgetSize, { columns: number; rows: number }> = {
  small: { columns: 1, rows: 1 },
  medium: { columns: 2, rows: 1 },
  large: { columns: 4, rows: 2 }
};

export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === "string" && (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value);
}

function isDashboardWidgetSize(value: unknown): value is DashboardWidgetSize {
  return typeof value === "string" && (DASHBOARD_WIDGET_SIZES as readonly string[]).includes(value);
}

function getDefaultPlacement(id: DashboardWidgetId): DashboardWidgetPlacement {
  return DEFAULT_DASHBOARD_LAYOUT.widgets.find((widget) => widget.id === id)!;
}

// Accepts whatever the server stored - possibly written by an older or newer interface -
// and returns a layout every renderer can trust: known ids only, each exactly once, in a
// size the widget supports, with widgets this version added appended in their default form.
export function normalizeDashboardLayout(value: StoredDashboardLayout | DashboardLayout | null | undefined): DashboardLayout {
  if (!value || !Array.isArray(value.widgets)) {
    return DEFAULT_DASHBOARD_LAYOUT;
  }

  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetPlacement[] = [];

  for (const entry of value.widgets) {
    if (!isDashboardWidgetId(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const supportedSizes = DASHBOARD_WIDGET_SIZE_OPTIONS[entry.id];
    const size = isDashboardWidgetSize(entry.size) && supportedSizes.includes(entry.size)
      ? entry.size
      : getDefaultPlacement(entry.id).size;
    widgets.push({ id: entry.id, size, hidden: entry.hidden === true });
  }

  for (const placement of DEFAULT_DASHBOARD_LAYOUT.widgets) {
    if (!seen.has(placement.id)) widgets.push({ ...placement });
  }

  return { version: 1, widgets };
}

export function isDefaultDashboardLayout(layout: DashboardLayout): boolean {
  return areLayoutsEqual(layout, DEFAULT_DASHBOARD_LAYOUT);
}

export function areLayoutsEqual(left: DashboardLayout, right: DashboardLayout): boolean {
  return left.widgets.length === right.widgets.length
    && left.widgets.every((widget, index) => {
      const other = right.widgets[index];
      return widget.id === other.id && widget.size === other.size && widget.hidden === other.hidden;
    });
}

export function getVisibleWidgets(layout: DashboardLayout): DashboardWidgetPlacement[] {
  return layout.widgets.filter((widget) => !widget.hidden);
}

export function getHiddenWidgets(layout: DashboardLayout): DashboardWidgetPlacement[] {
  return layout.widgets.filter((widget) => widget.hidden);
}

export function resizeWidget(layout: DashboardLayout, id: DashboardWidgetId, size: DashboardWidgetSize): DashboardLayout {
  if (!DASHBOARD_WIDGET_SIZE_OPTIONS[id].includes(size)) return layout;
  return {
    version: 1,
    widgets: layout.widgets.map((widget) => (widget.id === id && widget.size !== size ? { ...widget, size } : widget))
  };
}

export function setWidgetHidden(layout: DashboardLayout, id: DashboardWidgetId, hidden: boolean): DashboardLayout {
  const widgets = layout.widgets.map((widget) => (widget.id === id && widget.hidden !== hidden ? { ...widget, hidden } : widget));
  // A widget brought back joins the end of the visible run rather than reappearing in
  // the middle of an arrangement the user has since tidied around it.
  if (!hidden) {
    const shown = widgets.find((widget) => widget.id === id)!;
    const others = widgets.filter((widget) => widget.id !== id);
    const lastVisibleIndex = others.reduce((last, widget, index) => (widget.hidden ? last : index), -1);
    others.splice(lastVisibleIndex + 1, 0, shown);
    return { version: 1, widgets: others };
  }
  return { version: 1, widgets };
}

// Moves a widget so that it lands at `targetIndex` among the *visible* widgets. Hidden
// widgets keep their relative place at the end of the list.
export function moveWidget(layout: DashboardLayout, id: DashboardWidgetId, targetIndex: number): DashboardLayout {
  const visible = getVisibleWidgets(layout);
  const fromIndex = visible.findIndex((widget) => widget.id === id);
  if (fromIndex === -1) return layout;
  const boundedIndex = Math.max(0, Math.min(visible.length - 1, targetIndex));
  if (boundedIndex === fromIndex) return layout;

  const reordered = [...visible];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(boundedIndex, 0, moved);
  return { version: 1, widgets: [...reordered, ...getHiddenWidgets(layout)] };
}

export function moveWidgetBy(layout: DashboardLayout, id: DashboardWidgetId, delta: number): DashboardLayout {
  const fromIndex = getVisibleWidgets(layout).findIndex((widget) => widget.id === id);
  if (fromIndex === -1) return layout;
  return moveWidget(layout, id, fromIndex + delta);
}

// Drops `id` before or after `targetId` among the visible widgets.
export function moveWidgetRelativeTo(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  targetId: DashboardWidgetId,
  position: "before" | "after"
): DashboardLayout {
  if (id === targetId) return layout;
  const visible = getVisibleWidgets(layout);
  const fromIndex = visible.findIndex((widget) => widget.id === id);
  const targetIndex = visible.findIndex((widget) => widget.id === targetId);
  if (fromIndex === -1 || targetIndex === -1) return layout;

  const remaining = visible.filter((widget) => widget.id !== id);
  const insertionIndex = remaining.findIndex((widget) => widget.id === targetId) + (position === "after" ? 1 : 0);
  remaining.splice(insertionIndex, 0, visible[fromIndex]);
  return { version: 1, widgets: [...remaining, ...getHiddenWidgets(layout)] };
}
