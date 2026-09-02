import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DragIndicatorRoundedIcon from "@mui/icons-material/DragIndicatorRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { alpha, Box, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import {
  DASHBOARD_WIDGET_SIZE_OPTIONS,
  DASHBOARD_WIDGET_SPANS,
  getVisibleWidgets,
  moveWidgetBy,
  moveWidgetRelativeTo,
  resizeWidget,
  setWidgetHidden,
  type DashboardLayout,
  type DashboardWidgetId,
  type DashboardWidgetPlacement,
  type DashboardWidgetSize
} from "./dashboardLayout";
import { DASHBOARD_WIDGETS } from "./DashboardWidgetRegistry";
import type { DashboardWidgetContext } from "./DashboardWidgetPrimitives";

// One grid row on the desktop grid. Small and medium widgets take one, large takes two.
export const DASHBOARD_ROW_HEIGHT = 236;
const GRID_GAP = 1.5;

type DashboardWidgetGridProps = {
  layout: DashboardLayout;
  editing: boolean;
  context: DashboardWidgetContext;
  onLayoutChange: (layout: DashboardLayout) => void;
  onAnnounce: (message: string) => void;
};

type DropTarget = { id: DashboardWidgetId; position: "before" | "after" };

// Edit controls are compact beside a mouse and grow to a finger-sized target on touch,
// where the move buttons are the only way to reorder (HTML5 drag and drop is inert there).
const EDIT_CONTROL_SX = {
  width: 26,
  height: 26,
  "@media (pointer: coarse)": { width: 40, height: 40 }
} as const;

export function DashboardWidgetGrid({ layout, editing, context, onLayoutChange, onAnnounce }: DashboardWidgetGridProps) {
  const { t } = useTranslation();
  const [draggingId, setDraggingId] = React.useState<DashboardWidgetId | null>(null);
  const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);
  const visibleWidgets = getVisibleWidgets(layout);

  React.useEffect(() => {
    if (!editing) {
      setDraggingId(null);
      setDropTarget(null);
    }
  }, [editing]);

  const widgetName = (id: DashboardWidgetId) => t(`dashboard.widgets.${id}.title`);

  function move(id: DashboardWidgetId, delta: number) {
    const next = moveWidgetBy(layout, id, delta);
    if (next === layout) return;
    onLayoutChange(next);
    const position = getVisibleWidgets(next).findIndex((widget) => widget.id === id) + 1;
    onAnnounce(t("dashboard.home.edit.moved", { widget: widgetName(id), position, total: getVisibleWidgets(next).length }));
  }

  function resize(id: DashboardWidgetId, size: DashboardWidgetSize) {
    const next = resizeWidget(layout, id, size);
    if (next === layout) return;
    onLayoutChange(next);
    onAnnounce(t("dashboard.home.edit.resized", { widget: widgetName(id), size: t(`dashboard.home.edit.sizes.${size}`) }));
  }

  function hide(id: DashboardWidgetId) {
    onLayoutChange(setWidgetHidden(layout, id, true));
    onAnnounce(t("dashboard.home.edit.hidden", { widget: widgetName(id) }));
  }

  // The side the indicator showed during the last drag-over is the side the drop honours.
  function drop(targetId: DashboardWidgetId, fallbackPosition: "before" | "after") {
    if (!draggingId) return;
    const position = dropTarget?.id === targetId ? dropTarget.position : fallbackPosition;
    const next = moveWidgetRelativeTo(layout, draggingId, targetId, position);
    if (next !== layout) {
      onLayoutChange(next);
      const index = getVisibleWidgets(next).findIndex((widget) => widget.id === draggingId) + 1;
      onAnnounce(t("dashboard.home.edit.moved", { widget: widgetName(draggingId), position: index, total: getVisibleWidgets(next).length }));
    }
    setDraggingId(null);
    setDropTarget(null);
  }

  return (
    <Box
      data-dashboard-grid
      data-editing={editing ? "true" : undefined}
      sx={{
        display: "grid",
        gap: GRID_GAP,
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          md: "repeat(2, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))"
        },
        gridAutoRows: { xs: "auto", md: `${DASHBOARD_ROW_HEIGHT}px` },
        gridAutoFlow: "row"
      }}
    >
      {visibleWidgets.map((placement, index) => (
        <WidgetFrame
          key={placement.id}
          placement={placement}
          index={index}
          total={visibleWidgets.length}
          editing={editing}
          context={context}
          dragging={draggingId === placement.id}
          dropPosition={dropTarget?.id === placement.id ? dropTarget.position : null}
          onDragStart={() => setDraggingId(placement.id)}
          onDragEnd={() => {
            setDraggingId(null);
            setDropTarget(null);
          }}
          onDragOver={(position) => {
            if (!draggingId || draggingId === placement.id) return;
            if (dropTarget?.id !== placement.id || dropTarget.position !== position) {
              setDropTarget({ id: placement.id, position });
            }
          }}
          onDrop={(position) => drop(placement.id, position)}
          onMove={(delta) => move(placement.id, delta)}
          onResize={(size) => resize(placement.id, size)}
          onHide={() => hide(placement.id)}
        />
      ))}
    </Box>
  );
}

type WidgetFrameProps = {
  placement: DashboardWidgetPlacement;
  index: number;
  total: number;
  editing: boolean;
  context: DashboardWidgetContext;
  dragging: boolean;
  dropPosition: "before" | "after" | null;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (position: "before" | "after") => void;
  onDrop: (position: "before" | "after") => void;
  onMove: (delta: number) => void;
  onResize: (size: DashboardWidgetSize) => void;
  onHide: () => void;
};

function WidgetFrame({
  placement,
  index,
  total,
  editing,
  context,
  dragging,
  dropPosition,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onMove,
  onResize,
  onHide
}: WidgetFrameProps) {
  const { t } = useTranslation();
  const Widget = DASHBOARD_WIDGETS[placement.id];
  const span = DASHBOARD_WIDGET_SPANS[placement.size];
  const sizes = DASHBOARD_WIDGET_SIZE_OPTIONS[placement.id];
  const titleId = `dashboard-widget-${placement.id}-title`;
  const name = t(`dashboard.widgets.${placement.id}.title`);

  // Where the pointer sits decides whether the dragged widget lands before or after this
  // one, read from the pointer's position along the widget's longer side.
  function positionFromEvent(event: React.DragEvent<HTMLElement>): "before" | "after" {
    const rect = event.currentTarget.getBoundingClientRect();
    const horizontal = rect.width >= rect.height;
    const ratio = horizontal ? (event.clientX - rect.left) / rect.width : (event.clientY - rect.top) / rect.height;
    return ratio < 0.5 ? "before" : "after";
  }

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-widget-id={placement.id}
      data-widget-size={placement.size}
      draggable={editing || undefined}
      onDragStart={editing ? (event) => {
        event.dataTransfer.setData("text/plain", placement.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      } : undefined}
      onDragEnd={editing ? onDragEnd : undefined}
      onDragOver={editing ? (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDragOver(positionFromEvent(event));
      } : undefined}
      onDrop={editing ? (event) => {
        event.preventDefault();
        onDrop(positionFromEvent(event));
      } : undefined}
      sx={(theme) => ({
        gridColumn: {
          xs: "span 1",
          md: `span ${Math.min(2, span.columns)}`,
          lg: `span ${span.columns}`
        },
        gridRow: { xs: "auto", md: `span ${span.rows}` },
        minWidth: 0,
        minHeight: { xs: 148, md: 0 },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
        border: "1px solid",
        borderColor: editing ? alpha(theme.palette.primary.main, 0.55) : "divider",
        borderStyle: editing ? "dashed" : "solid",
        borderRadius: "var(--rc-radius-panel)",
        bgcolor: "background.paper",
        opacity: dragging ? 0.45 : 1,
        cursor: editing ? "grab" : undefined,
        transition: "border-color var(--rc-motion-base) ease, opacity var(--rc-motion-fast) ease, box-shadow var(--rc-motion-fast) ease",
        boxShadow: dropPosition
          ? `inset ${dropPosition === "before" ? "3px" : "-3px"} 0 0 ${theme.palette.primary.main}`
          : "none",
        "&:active": editing ? { cursor: "grabbing" } : undefined
      })}
    >
      {editing ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          data-widget-controls
          sx={{
            minHeight: 36,
            "@media (pointer: coarse)": { minHeight: 48 },
            flexShrink: 0,
            pl: 0.75,
            pr: 0.5,
            bgcolor: "var(--rc-surface-2)",
            borderBottom: "1px dashed",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.4)
          }}
        >
          <DragIndicatorRoundedIcon aria-hidden="true" sx={{ fontSize: 18, color: "text.disabled" }} />
          <Typography variant="caption" noWrap sx={{ fontWeight: 500, flexGrow: 1, minWidth: 0 }}>{name}</Typography>
          {sizes.length > 1 ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={placement.size}
              aria-label={t("dashboard.home.edit.sizeOf", { widget: name })}
              onChange={(_, value: DashboardWidgetSize | null) => {
                if (value) onResize(value);
              }}
              sx={{ "& .MuiToggleButton-root": { minWidth: 26, minHeight: 26, px: 0.5, py: 0, fontFamily: "var(--rc-font-mono)", fontSize: 10, "@media (pointer: coarse)": { minWidth: 40, minHeight: 40 } } }}
            >
              {sizes.map((size) => (
                <ToggleButton key={size} value={size} aria-label={t(`dashboard.home.edit.sizes.${size}`)}>
                  {t(`dashboard.home.edit.sizeShort.${size}`)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          ) : null}
          <Tooltip title={t("dashboard.home.edit.moveEarlier", { widget: name })}>
            <span>
              <IconButton size="small" disabled={index === 0} aria-label={t("dashboard.home.edit.moveEarlier", { widget: name })} onClick={() => onMove(-1)} sx={EDIT_CONTROL_SX}>
                <ArrowBackRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("dashboard.home.edit.moveLater", { widget: name })}>
            <span>
              <IconButton size="small" disabled={index === total - 1} aria-label={t("dashboard.home.edit.moveLater", { widget: name })} onClick={() => onMove(1)} sx={EDIT_CONTROL_SX}>
                <ArrowForwardRoundedIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t("dashboard.home.edit.hide", { widget: name })}>
            <IconButton size="small" aria-label={t("dashboard.home.edit.hide", { widget: name })} onClick={onHide} sx={EDIT_CONTROL_SX}>
              <VisibilityOffOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      ) : null}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          // While editing, the widget is a tile to arrange rather than a control to use.
          pointerEvents: editing ? "none" : undefined,
          userSelect: editing ? "none" : undefined
        }}
        aria-hidden={editing || undefined}
      >
        <Widget size={placement.size} titleId={titleId} context={context} />
      </Box>
    </Box>
  );
}
