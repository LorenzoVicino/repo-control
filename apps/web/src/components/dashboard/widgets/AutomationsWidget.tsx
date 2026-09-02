import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { Box, CircularProgress, Stack, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchWorkflowRuns, fetchWorkflows } from "../../../api/workflows";
import type { WorkflowRun } from "../../../types/workflows";
import { formatDurationMs, formatRelativeTime } from "../../../utils/time";
import { ColumnChart } from "../DashboardCharts";
import { getWorkflowRunStatusColor, getWorkflowRunStatusLabelKey, isActiveWorkflowRunStatus } from "../../automation/workflowRunStatus";
import { StateDot, WidgetBody, WidgetEmpty, WidgetError, WidgetFigure, WidgetHeader, WidgetRow, WidgetRowsSkeleton, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

const ACTIVE_RUNS_POLL_INTERVAL_MS = 3000;
const LIMIT = { small: 3, medium: 6, large: 6 } as const;
const CHART_RUN_LIMIT = { small: 12, medium: 24, large: 24 } as const;

const TONE_COLOR: Record<ReturnType<typeof getWorkflowRunStatusColor>, string> = {
  success: "success.main",
  warning: "warning.main",
  error: "error.main",
  info: "info.main",
  default: "text.disabled"
};

export function AutomationsWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: fetchWorkflows, staleTime: 30 * 1000 });
  const runsQuery = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => fetchWorkflowRuns(),
    staleTime: 15 * 1000,
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => isActiveWorkflowRunStatus(run.status)) ? ACTIVE_RUNS_POLL_INTERVAL_MS : false
  });
  const runs = React.useMemo(() => sortRuns(runsQuery.data?.runs ?? []), [runsQuery.data?.runs]);
  const activeRuns = runs.filter((run) => isActiveWorkflowRunStatus(run.status));
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (activeRuns.length === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeRuns.length]);
  // Oldest on the left, newest on the right; a run still going is measured up to now.
  const chartRuns = React.useMemo(
    () => runs.filter((run) => run.mode === "run").slice(0, CHART_RUN_LIMIT[size]).reverse(),
    [runs, size]
  );
  const runDuration = (run: WorkflowRun) => (isActiveWorkflowRunStatus(run.status) ? Math.max(0, now - Date.parse(run.startedAt)) : run.durationMs);
  const workflowCount = workflowsQuery.data?.workflows.length ?? 0;
  const isLoading = workflowsQuery.isLoading || runsQuery.isLoading;
  const error = workflowsQuery.error ?? runsQuery.error;

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.automations.title")}
        meta={activeRuns.length > 0
          ? t("dashboard.widgets.automations.activeCount", { count: activeRuns.length })
          : workflowCount > 0 ? t("dashboard.widgets.automations.workflowCount", { count: workflowCount }) : undefined}
        action={workflowCount > 0 ? { label: t("dashboard.widgets.automations.open"), onClick: () => context.onNavigate("automations") } : undefined}
      />
      {isLoading ? (
        <WidgetRowsSkeleton rows={2} label={t("dashboard.widgets.automations.loading")} />
      ) : error ? (
        <WidgetError
          message={error instanceof Error ? error.message : t("dashboard.widgets.automations.error")}
          onRetry={() => void Promise.all([workflowsQuery.refetch(), runsQuery.refetch()])}
          retryLabel={t("dashboard.widgets.shared.retry")}
        />
      ) : workflowCount === 0 ? (
        <WidgetEmpty
          icon={<HubOutlinedIcon />}
          title={t("dashboard.widgets.automations.empty")}
          hint={t("dashboard.widgets.automations.emptyHint")}
          action={{ label: t("dashboard.widgets.automations.create"), onClick: () => context.onNavigate("automations") }}
        />
      ) : runs.length === 0 ? (
        <WidgetEmpty
          icon={<HubOutlinedIcon />}
          title={t("dashboard.widgets.automations.noRuns")}
          hint={t("dashboard.widgets.automations.noRunsHint")}
        />
      ) : (
        <>
          {chartRuns.length > 0 ? (
            <Box sx={{ px: 1.5, pt: 1, pb: 0.9, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "baseline" }} spacing={{ xs: 0, sm: 1 }} sx={{ mb: 0.6 }}>
                <Typography variant="caption" sx={{ fontWeight: 500, flexGrow: 1 }}>
                  {t("dashboard.widgets.automations.chartTitle", { count: chartRuns.length })}
                </Typography>
                <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10, color: "text.secondary" }}>
                  {t("dashboard.widgets.automations.chartMax", { duration: formatDurationMs(Math.max(...chartRuns.map(runDuration))) })}
                </Typography>
              </Stack>
              <ColumnChart
                height={44}
                ariaLabel={t("dashboard.widgets.automations.chartAria", { count: chartRuns.length })}
                columns={chartRuns.map((run) => {
                  const active = isActiveWorkflowRunStatus(run.status);
                  return {
                    key: run.id,
                    value: runDuration(run),
                    color: resolveRunColor(theme, getWorkflowRunStatusColor(run.status)),
                    emphasis: active,
                    title: `${run.workflowName} · ${t(`automation.runStatus.${getWorkflowRunStatusLabelKey(run.status)}`)} · ${formatDurationMs(runDuration(run))} · ${formatRelativeTime(run.startedAt, language) ?? ""}`
                  };
                })}
              />
            </Box>
          ) : null}
          <WidgetBody columns={size === "medium" ? 2 : 1}>
          {runs.slice(0, LIMIT[size]).map((run) => {
            const active = isActiveWorkflowRunStatus(run.status);
            const tone = TONE_COLOR[getWorkflowRunStatusColor(run.status)];
            const when = formatRelativeTime(active ? run.startedAt : run.completedAt || run.startedAt, language);
            return (
              <WidgetRow
                key={run.id}
                onClick={() => context.onNavigate("automations")}
                ariaLabel={t("dashboard.widgets.automations.openRun", { name: run.workflowName })}
                leading={active ? <CircularProgress size={12} thickness={5} aria-hidden="true" /> : <StateDot tone={tone} />}
                primary={run.workflowName}
                secondary={active
                  ? t("dashboard.widgets.automations.startedAt", { time: when ?? "" })
                  : run.mode === "dry-run" ? t("dashboard.widgets.automations.dryRun", { time: when ?? "" }) : when ?? undefined}
                trailing={<WidgetFigure tone={tone}>{t(`automation.runStatus.${getWorkflowRunStatusLabelKey(run.status)}`)}</WidgetFigure>}
              />
            );
          })}
          </WidgetBody>
        </>
      )}
    </>
  );
}

function resolveRunColor(theme: Theme, color: ReturnType<typeof getWorkflowRunStatusColor>): string {
  return color === "default" ? theme.palette.text.disabled : theme.palette[color].main;
}

// Anything still running leads; then the newest finished run.
function sortRuns(runs: WorkflowRun[]): WorkflowRun[] {
  return [...runs].sort((left, right) => {
    const activeDelta = Number(isActiveWorkflowRunStatus(right.status)) - Number(isActiveWorkflowRunStatus(left.status));
    return activeDelta || Date.parse(right.startedAt) - Date.parse(left.startedAt);
  });
}
