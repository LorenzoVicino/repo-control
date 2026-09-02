import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../../utils/time";
import { ChartLegend, RingChart, StackedBar, type ChartSegment } from "../DashboardCharts";
import { classifyProject, getLocalChangeCount, PROJECT_STATE_TONE, type ProjectState } from "../dashboardInsights";
import { WidgetEmpty, WidgetFigure, WidgetHeader, WidgetRow, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

const STATE_ORDER: ProjectState[] = ["changes", "behind", "ahead", "inSync"];
const CHANGE_KINDS = ["staged", "modified", "untracked"] as const;
const CHANGE_LOAD_LIMIT = 5;
// On a phone the widget stacks its two halves, so the change list is kept short to leave
// the resume widgets within reach.
const CHANGE_LOAD_LIMIT_STACKED = 3;

type ChangeKind = (typeof CHANGE_KINDS)[number];

export function WorkspaceWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [activeState, setActiveState] = React.useState<string | null>(null);
  const isStacked = useMediaQuery(theme.breakpoints.down("sm"));
  const total = context.projects.length;
  const counts = React.useMemo(() => {
    const result: Record<ProjectState, number> = { changes: 0, behind: 0, ahead: 0, inSync: 0 };
    for (const project of context.projects) result[classifyProject(project)] += 1;
    return result;
  }, [context.projects]);
  const changeLoad = React.useMemo(
    () => context.projects
      .filter((project) => getLocalChangeCount(project) > 0)
      .sort((left, right) => getLocalChangeCount(right) - getLocalChangeCount(left) || left.name.localeCompare(right.name))
      .slice(0, isStacked ? CHANGE_LOAD_LIMIT_STACKED : CHANGE_LOAD_LIMIT),
    [context.projects, isStacked]
  );
  const localChanges = React.useMemo(() => context.projects.reduce((sum, project) => sum + getLocalChangeCount(project), 0), [context.projects]);
  const maxChangeLoad = Math.max(1, ...changeLoad.map(getLocalChangeCount));
  const scannedLabel = context.isRefreshing
    ? t("dashboard.widgets.workspace.scanning")
    : formatRelativeTime(new Date(context.scannedAt).toISOString(), language);
  const segments: ChartSegment[] = STATE_ORDER.map((state) => ({
    key: state,
    value: counts[state],
    color: resolveTone(theme, PROJECT_STATE_TONE[state]),
    label: t(`dashboard.widgets.workspace.states.${state}`)
  }));
  const activeSegment = segments.find((segment) => segment.key === activeState && segment.value > 0) ?? null;
  const description = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => `${segment.value} ${segment.label.toLocaleLowerCase(language)}`)
    .join(", ");
  // The staging pipeline is ordered - new, then modified, then staged for commit - so the
  // three kinds take one hue in three steps, darkest closest to the commit.
  const changeColors: Record<ChangeKind, string> = {
    staged: theme.palette.primary.dark,
    modified: theme.palette.primary.main,
    untracked: theme.palette.primary.light
  };

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.workspace.title")}
        meta={total > 0 ? t("dashboard.widgets.workspace.repositoryCount", { count: total }) : undefined}
      />
      {total === 0 ? (
        <WidgetEmpty
          icon={<FolderOpenOutlinedIcon />}
          title={t("dashboard.widgets.workspace.empty")}
          hint={t("dashboard.widgets.workspace.emptyHint")}
          action={{ label: t("dashboard.widgets.workspace.pickFolder"), onClick: context.onPickWorkspace }}
        />
      ) : (
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            display: "grid",
            gridTemplateColumns: size === "medium" ? { xs: "1fr", sm: "minmax(0, 1fr) minmax(0, 1fr)" } : "1fr",
            alignItems: "stretch"
          }}
        >
          <Stack sx={{ minWidth: 0, px: 1.5, py: 1.25 }} spacing={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <RingChart
                segments={segments}
                ariaLabel={t("dashboard.widgets.workspace.distribution", { description })}
                activeKey={activeState}
                onActiveKeyChange={setActiveState}
              >
                <Typography
                  component="span"
                  data-testid="workspace-ring-readout"
                  sx={{ fontSize: 21, fontWeight: 500, lineHeight: 1, letterSpacing: "-0.02em", color: activeSegment ? activeSegment.color : "text.primary", transition: "color var(--rc-motion-fast) ease" }}
                >
                  {activeSegment ? activeSegment.value : total}
                </Typography>
              </RingChart>
              <ChartLegend
                activeKey={activeState}
                onActiveKeyChange={setActiveState}
                items={segments.map((segment) => ({
                  key: segment.key,
                  color: segment.color,
                  label: segment.label,
                  value: segment.value,
                  muted: segment.value === 0
                }))}
              />
            </Stack>
            <Box sx={{ mt: "auto" }}>
              <Typography variant="caption" color="text.secondary" component="div">
                {t("dashboard.widgets.workspace.localChanges", { count: localChanges })}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                {scannedLabel ? t("dashboard.widgets.workspace.scanned", { time: scannedLabel }) : null}
              </Typography>
            </Box>
          </Stack>

          {size === "medium" ? (
            <Box sx={{ minWidth: 0, borderLeft: { sm: "1px solid" }, borderTop: { xs: "1px solid", sm: 0 }, borderColor: "divider", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} useFlexGap flexWrap="wrap" sx={{ px: 1.5, pt: 1, pb: 0.5, flexShrink: 0 }}>
                <Typography variant="caption" noWrap sx={{ fontWeight: 500, flexGrow: 1 }}>
                  {t("dashboard.widgets.workspace.changeConcentration")}
                </Typography>
                <Stack direction="row" spacing={1} component="ul" sx={{ listStyle: "none", m: 0, p: 0 }} aria-label={t("dashboard.widgets.workspace.changeLegend")}>
                  {CHANGE_KINDS.map((kind) => (
                    <Stack key={kind} component="li" direction="row" spacing={0.5} alignItems="center">
                      <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: changeColors[kind] }} />
                      <Typography sx={{ fontSize: 10, color: "text.secondary" }}>{t(`dashboard.widgets.workspace.changeKinds.${kind}`)}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
              {changeLoad.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
                  {t("dashboard.widgets.workspace.treesAligned")}
                </Typography>
              ) : (
                <Box sx={{ overflowY: { xs: "visible", md: "auto" }, minHeight: 0 }}>
                  {changeLoad.map((project) => (
                    <WidgetRow
                      key={project.id}
                      minHeight={38}
                      onClick={() => context.onOpenProject(project.id)}
                      ariaLabel={t("dashboard.widgets.workspace.openChanges", { name: project.name, count: getLocalChangeCount(project) })}
                      primary={project.name}
                      secondary={(
                        <Box component="span" sx={{ display: "block", pt: 0.35 }}>
                          <StackedBar
                            segments={CHANGE_KINDS.map((kind) => ({ key: kind, value: project[kind], color: changeColors[kind], label: t(`dashboard.widgets.workspace.changeKinds.${kind}`) }))}
                            max={maxChangeLoad}
                            height={6}
                          />
                        </Box>
                      )}
                      trailing={<WidgetFigure tone="text.primary">{getLocalChangeCount(project)}</WidgetFigure>}
                    />
                  ))}
                </Box>
              )}
            </Box>
          ) : null}
        </Box>
      )}
    </>
  );
}

function resolveTone(theme: Theme, tone: string): string {
  const [paletteKey] = tone.split(".") as ["success" | "warning" | "error" | "info"];
  return theme.palette[paletteKey].main;
}
