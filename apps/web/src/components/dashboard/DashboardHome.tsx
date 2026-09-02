import AddRoundedIcon from "@mui/icons-material/AddRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { Box, Button, Stack, Tooltip, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";
import { needsAttention } from "./dashboardInsights";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  getHiddenWidgets,
  isDefaultDashboardLayout,
  resizeWidget,
  setWidgetHidden,
  type DashboardLayout,
  type DashboardWidgetId
} from "./dashboardLayout";
import { DashboardWidgetGrid } from "./DashboardWidgetGrid";
import type { DashboardWidgetContext } from "./DashboardWidgetPrimitives";
import type { DashboardSection } from "./DashboardSidebar";

type DashboardHomeProps = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  recentProjectIds: string[];
  dockerStatus: DockerContainersResponse | undefined;
  isLoadingDocker: boolean;
  workspaceRoot: string;
  scannedAt: number;
  isRefreshing: boolean;
  layout: DashboardLayout;
  // False while the saved preferences are unavailable: the layout still renders, but a
  // change that could not be stored is not offered.
  canEditLayout: boolean;
  onLayoutChange: (layout: DashboardLayout) => void;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSearch: () => void;
  onPickWorkspace: () => void;
  onRefreshWorkspace: () => void;
};

export const DashboardHome = React.memo(function DashboardHome({
  projects,
  favoriteProjectIds,
  recentProjectIds,
  dockerStatus,
  isLoadingDocker,
  workspaceRoot,
  scannedAt,
  isRefreshing,
  layout,
  canEditLayout,
  onLayoutChange,
  onNavigate,
  onOpenProject,
  onOpenSearch,
  onPickWorkspace,
  onRefreshWorkspace
}: DashboardHomeProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState("");
  const attentionCount = React.useMemo(() => projects.filter(needsAttention).length, [projects]);
  // On a machine without Docker the default arrangement would spend a first-viewport
  // column saying so forever; the untouched default therefore starts without the runtime
  // widget, which stays one click away in the hidden tray. A layout the user has arranged
  // is left exactly as saved.
  const effectiveLayout = React.useMemo(
    () => (dockerStatus?.ok === false && isDefaultDashboardLayout(layout)
      // Workspace takes the column the runtime widget would have filled.
      ? resizeWidget(setWidgetHidden(layout, "runtime", true), "workspace", "medium")
      : layout),
    [dockerStatus?.ok, layout]
  );
  const hiddenWidgets = getHiddenWidgets(effectiveLayout);

  React.useEffect(() => {
    if (!canEditLayout) setEditing(false);
  }, [canEditLayout]);

  const context = React.useMemo<DashboardWidgetContext>(() => ({
    projects,
    favoriteProjectIds,
    recentProjectIds,
    dockerStatus,
    isLoadingDocker,
    workspaceRoot,
    scannedAt,
    isRefreshing,
    onNavigate,
    onOpenProject,
    onOpenSearch,
    onPickWorkspace,
    onRefreshWorkspace
  }), [
    dockerStatus,
    favoriteProjectIds,
    isLoadingDocker,
    isRefreshing,
    onNavigate,
    onOpenProject,
    onOpenSearch,
    onPickWorkspace,
    onRefreshWorkspace,
    projects,
    recentProjectIds,
    scannedAt,
    workspaceRoot
  ]);

  function showWidget(id: DashboardWidgetId) {
    onLayoutChange(setWidgetHidden(effectiveLayout, id, false));
    setAnnouncement(t("dashboard.home.edit.shown", { widget: t(`dashboard.widgets.${id}.title`) }));
  }

  function resetLayout() {
    onLayoutChange(DEFAULT_DASHBOARD_LAYOUT);
    setAnnouncement(t("dashboard.home.edit.reset"));
  }

  const headline = projects.length === 0
    ? t("dashboard.home.headline.empty")
    : attentionCount === 0
      ? t("dashboard.home.headline.allClear", { count: projects.length })
      : t("dashboard.home.headline.attention", { attention: attentionCount, total: projects.length });

  return (
    <Stack spacing={2}>
      <Box
        component="header"
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 1.5,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
          <Typography id="dashboard-home-title" component="h1" variant="h1" sx={{ textWrap: "balance" }}>
            {headline}
          </Typography>
          <Typography
            component="p"
            noWrap
            color="text.secondary"
            title={workspaceRoot}
            sx={{ mt: 0.6, fontFamily: "var(--rc-font-mono)", fontSize: 11, maxWidth: 720 }}
          >
            {workspaceRoot || t("dashboard.home.noWorkspace")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {editing ? (
            <>
              <Button size="small" variant="text" disabled={isDefaultDashboardLayout(layout)} onClick={resetLayout} data-testid="dashboard-reset-layout">
                {t("dashboard.home.edit.resetAction")}
              </Button>
              <Button size="small" variant="contained" onClick={() => setEditing(false)} data-testid="dashboard-done-editing">
                {t("dashboard.home.edit.done")}
              </Button>
            </>
          ) : (
            <Tooltip title={canEditLayout ? "" : t("dashboard.home.edit.unavailable")}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TuneRoundedIcon />}
                  disabled={!canEditLayout}
                  onClick={() => setEditing(true)}
                  data-testid="dashboard-customize"
                >
                  {t("dashboard.home.edit.customize")}
                </Button>
              </span>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {editing ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5 }}>
          {t("dashboard.home.edit.hint")}
        </Typography>
      ) : null}

      <DashboardWidgetGrid
        layout={effectiveLayout}
        editing={editing}
        context={context}
        onLayoutChange={onLayoutChange}
        onAnnounce={setAnnouncement}
      />

      {editing ? (
        <Box
          component="section"
          aria-labelledby="dashboard-hidden-widgets-title"
          sx={{ p: 1.5, border: "1px dashed", borderColor: "divider", borderRadius: "var(--rc-radius-panel)" }}
        >
          <Typography id="dashboard-hidden-widgets-title" component="h2" variant="h6">
            {t("dashboard.home.edit.hiddenWidgets")}
          </Typography>
          {hiddenWidgets.length === 0 ? (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {t("dashboard.home.edit.allVisible")}
            </Typography>
          ) : (
            <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
              {hiddenWidgets.map((widget) => (
                <Button
                  key={widget.id}
                  size="small"
                  variant="outlined"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => showWidget(widget.id)}
                  aria-label={t("dashboard.home.edit.show", { widget: t(`dashboard.widgets.${widget.id}.title`) })}
                >
                  {t(`dashboard.widgets.${widget.id}.title`)}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      ) : null}

      <Box role="status" aria-live="polite" sx={visuallyHidden}>{announcement}</Box>
    </Stack>
  );
});

// Pixel strings on purpose: in `sx`, a bare `1` for width means 100% of the parent.
const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0
} as const;
