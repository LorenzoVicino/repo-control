import { describe, expect, it } from "vitest";
import {
  areLayoutsEqual,
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGET_SIZE_OPTIONS,
  DEFAULT_DASHBOARD_LAYOUT,
  getHiddenWidgets,
  getVisibleWidgets,
  isDefaultDashboardLayout,
  moveWidget,
  moveWidgetBy,
  moveWidgetRelativeTo,
  normalizeDashboardLayout,
  resizeWidget,
  setWidgetHidden
} from "./dashboardLayout";

const visibleIds = (layout: ReturnType<typeof normalizeDashboardLayout>) => getVisibleWidgets(layout).map((widget) => widget.id);

describe("dashboardLayout", () => {
  it("lists every registered widget exactly once in the default layout, in a supported size", () => {
    const ids = DEFAULT_DASHBOARD_LAYOUT.widgets.map((widget) => widget.id);
    expect([...ids].sort()).toEqual([...DASHBOARD_WIDGET_IDS].sort());
    for (const widget of DEFAULT_DASHBOARD_LAYOUT.widgets) {
      expect(DASHBOARD_WIDGET_SIZE_OPTIONS[widget.id]).toContain(widget.size);
    }
    expect(isDefaultDashboardLayout(DEFAULT_DASHBOARD_LAYOUT)).toBe(true);
  });

  it("falls back to the default layout when nothing is stored", () => {
    expect(normalizeDashboardLayout(null)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(normalizeDashboardLayout(undefined)).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it("drops unknown widgets, repairs unsupported sizes, dedupes and appends new widgets", () => {
    const layout = normalizeDashboardLayout({
      version: 1,
      widgets: [
        { id: "shortcuts", size: "large", hidden: false },
        { id: "retired-widget", size: "small", hidden: false },
        { id: "attention", size: "large", hidden: false },
        { id: "attention", size: "small", hidden: true }
      ]
    });

    expect(layout.widgets[0]).toEqual({ id: "shortcuts", size: "medium", hidden: false });
    expect(layout.widgets[1]).toEqual({ id: "attention", size: "large", hidden: false });
    expect(layout.widgets.map((widget) => widget.id)).toHaveLength(DASHBOARD_WIDGET_IDS.length);
    expect(layout.widgets.find((widget) => widget.id === "favorites")?.hidden).toBe(true);
    expect(layout.widgets.find((widget) => widget.id === "runtime")?.hidden).toBe(false);
  });

  it("resizes only to a size the widget supports", () => {
    const large = resizeWidget(DEFAULT_DASHBOARD_LAYOUT, "attention", "large");
    expect(large.widgets[0].size).toBe("large");
    expect(resizeWidget(DEFAULT_DASHBOARD_LAYOUT, "attention", "small")).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(resizeWidget(large, "attention", "large")).toEqual(large);
  });

  it("hides a widget in place and brings it back at the end of the visible run", () => {
    const hidden = setWidgetHidden(DEFAULT_DASHBOARD_LAYOUT, "workspace", true);
    expect(visibleIds(hidden)).toEqual(["attention", "runtime", "resume", "chats", "automations", "shortcuts"]);
    expect(getHiddenWidgets(hidden).map((widget) => widget.id)).toEqual(["workspace", "favorites"]);

    const shown = setWidgetHidden(hidden, "favorites", false);
    expect(visibleIds(shown)).toEqual(["attention", "runtime", "resume", "chats", "automations", "shortcuts", "favorites"]);
    expect(getHiddenWidgets(shown).map((widget) => widget.id)).toEqual(["workspace"]);
  });

  it("moves widgets among the visible ones and keeps hidden ones at the end", () => {
    const moved = moveWidget(DEFAULT_DASHBOARD_LAYOUT, "shortcuts", 0);
    expect(visibleIds(moved)).toEqual(["shortcuts", "attention", "workspace", "runtime", "resume", "chats", "automations"]);
    expect(moved.widgets.at(-1)?.id).toBe("favorites");

    expect(moveWidgetBy(DEFAULT_DASHBOARD_LAYOUT, "attention", -1)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(visibleIds(moveWidgetBy(DEFAULT_DASHBOARD_LAYOUT, "attention", 1))).toEqual([
      "workspace", "attention", "runtime", "resume", "chats", "automations", "shortcuts"
    ]);
    expect(visibleIds(moveWidgetBy(DEFAULT_DASHBOARD_LAYOUT, "attention", 99))).toEqual([
      "workspace", "runtime", "resume", "chats", "automations", "shortcuts", "attention"
    ]);
    expect(moveWidget(DEFAULT_DASHBOARD_LAYOUT, "favorites", 0)).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it("drops a dragged widget before or after its target", () => {
    const before = moveWidgetRelativeTo(DEFAULT_DASHBOARD_LAYOUT, "chats", "attention", "before");
    expect(visibleIds(before)).toEqual(["chats", "attention", "workspace", "runtime", "resume", "automations", "shortcuts"]);

    const after = moveWidgetRelativeTo(DEFAULT_DASHBOARD_LAYOUT, "attention", "chats", "after");
    expect(visibleIds(after)).toEqual(["workspace", "runtime", "resume", "chats", "attention", "automations", "shortcuts"]);

    expect(moveWidgetRelativeTo(DEFAULT_DASHBOARD_LAYOUT, "attention", "attention", "after")).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(moveWidgetRelativeTo(DEFAULT_DASHBOARD_LAYOUT, "favorites", "attention", "after")).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it("compares layouts structurally", () => {
    const copy = normalizeDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, widgets: DEFAULT_DASHBOARD_LAYOUT.widgets.map((widget) => ({ ...widget })) });
    expect(areLayoutsEqual(copy, DEFAULT_DASHBOARD_LAYOUT)).toBe(true);
    expect(isDefaultDashboardLayout(resizeWidget(copy, "attention", "large"))).toBe(false);
  });
});
