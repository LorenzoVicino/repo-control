import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import EditNoteRoundedIcon from "@mui/icons-material/EditNoteRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Stack, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { fetchWorkflowRuns } from "../../../api/workflows";
import { formatRelativeTime } from "../../../utils/time";
import { StackedBar } from "../DashboardCharts";
import { buildAttentionQueue, type AttentionItem, type AttentionReason, type AttentionSeverity } from "../dashboardInsights";
import { WidgetBody, WidgetEmpty, WidgetHeader, WidgetRow, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

// The desktop grid scrolls a widget; a phone stacks them, so the queue is capped and the
// catalogue, sorted by attention, takes over past the cap.
const ITEM_LIMIT = { small: 8, medium: 8, large: 16 } as const;
const SEVERITY_ORDER: AttentionSeverity[] = ["critical", "warning", "action", "info"];
// Action items are ordinary work (changes to commit, a run to relaunch), so they take a
// neutral ink: only critical and warning carry a status colour.
const SEVERITY_TONE: Record<AttentionSeverity, string> = {
  critical: "error.main",
  warning: "warning.main",
  action: "text.secondary",
  info: "info.main"
};

export function AttentionWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { data: runsResponse } = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => fetchWorkflowRuns(),
    staleTime: 15 * 1000
  });
  const runs = runsResponse?.runs;
  const items = React.useMemo(
    () => buildAttentionQueue({ projects: context.projects, dockerStatus: context.dockerStatus, runs: runs ?? [] }),
    [context.dockerStatus, context.projects, runs]
  );

  const severityCounts = React.useMemo(() => {
    const counts: Record<AttentionSeverity, number> = { critical: 0, warning: 0, action: 0, info: 0 };
    for (const item of items) counts[item.severity] += 1;
    return counts;
  }, [items]);
  const severityColor: Record<AttentionSeverity, string> = {
    critical: theme.palette.error.main,
    warning: theme.palette.warning.main,
    action: theme.palette.text.secondary,
    info: theme.palette.info.main
  };

  function open(item: AttentionItem) {
    if (item.target.type === "project") context.onOpenProject(item.target.projectId);
    else context.onNavigate(item.target.section);
  }

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.attention.title")}
        meta={items.length > 0 ? t("dashboard.widgets.attention.meta", { count: items.length }) : undefined}
      />
      {items.length === 0 ? (
        <WidgetEmpty
          icon={<CheckCircleOutlineRoundedIcon />}
          title={context.projects.length === 0 ? t("dashboard.widgets.attention.noWorkspace") : t("dashboard.widgets.attention.empty")}
          hint={context.projects.length === 0 ? t("dashboard.widgets.attention.noWorkspaceHint") : t("dashboard.widgets.attention.emptyHint")}
        />
      ) : (
        <>
          <Box sx={{ px: 1.5, pt: 1, pb: 0.9, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
            <StackedBar
              height={6}
              ariaLabel={t("dashboard.widgets.attention.severityChart", {
                description: SEVERITY_ORDER.filter((severity) => severityCounts[severity] > 0)
                  .map((severity) => t(`dashboard.widgets.attention.severity.${severity}`, { count: severityCounts[severity] }))
                  .join(", ")
              })}
              segments={SEVERITY_ORDER.map((severity) => ({
                key: severity,
                value: severityCounts[severity],
                color: severityColor[severity],
                label: t(`dashboard.widgets.attention.severity.${severity}`, { count: severityCounts[severity] })
              }))}
            />
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" component="ul" sx={{ listStyle: "none", m: 0, mt: 0.7, p: 0 }}>
              {SEVERITY_ORDER.filter((severity) => severityCounts[severity] > 0).map((severity) => (
                <Stack key={severity} component="li" direction="row" spacing={0.55} alignItems="center">
                  <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: severityColor[severity] }} />
                  <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
                    {t(`dashboard.widgets.attention.severity.${severity}`, { count: severityCounts[severity] })}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
          <WidgetBody columns={size === "large" ? 2 : 1}>
          {items.slice(0, ITEM_LIMIT[size]).map((item) => (
            <WidgetRow
              key={item.id}
              onClick={() => open(item)}
              ariaLabel={t("dashboard.widgets.attention.open", { name: item.title })}
              leading={<SeverityIcon severity={item.severity} />}
              primary={(
                <>
                  {item.title}
                  {item.context ? (
                    <span style={{ fontFamily: "var(--rc-font-mono)", fontWeight: 400, opacity: 0.72 }}> · {item.context}</span>
                  ) : null}
                </>
              )}
              secondary={describeReasons(t, item.reasons, i18n.resolvedLanguage ?? i18n.language)}
              trailing={<ChevronRightRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />}
            />
          ))}
          {items.length > ITEM_LIMIT[size] ? (
            <WidgetRow
              minHeight={38}
              onClick={() => context.onNavigate("repositories")}
              primary={(
                <Typography component="span" variant="body2" color="primary.main" sx={{ fontWeight: 500 }}>
                  {t("dashboard.widgets.attention.showAll", { count: items.length - ITEM_LIMIT[size] })}
                </Typography>
              )}
            />
          ) : null}
          </WidgetBody>
        </>
      )}
    </>
  );
}

function SeverityIcon({ severity }: { severity: AttentionSeverity }) {
  const sx = { fontSize: 16, color: SEVERITY_TONE[severity] };
  if (severity === "critical") return <ErrorOutlineRoundedIcon sx={sx} />;
  if (severity === "warning") return <WarningAmberRoundedIcon sx={sx} />;
  if (severity === "action") return <EditNoteRoundedIcon sx={sx} />;
  return <ArrowUpwardRoundedIcon sx={sx} />;
}

// Reasons are typed so the same item reads correctly in both languages; the sentence is
// assembled here from short clauses joined with a middle dot.
function describeReasons(t: TFunction, reasons: AttentionReason[], language: string): string {
  return reasons.map((reason) => {
    switch (reason.kind) {
      case "containersUnhealthy":
        return t("dashboard.widgets.attention.reasons.containersUnhealthy", { count: reason.count });
      case "containersRestarting":
        return t("dashboard.widgets.attention.reasons.containersRestarting", { count: reason.count });
      case "runFailed":
        return t("dashboard.widgets.attention.reasons.runFailed", { time: formatRelativeTime(reason.startedAt, language) ?? "" }).trim();
      case "runInterrupted":
        return t("dashboard.widgets.attention.reasons.runInterrupted", { time: formatRelativeTime(reason.startedAt, language) ?? "" }).trim();
      case "behind":
        return t("dashboard.widgets.attention.reasons.behind", { count: reason.count });
      case "changes": {
        const total = reason.staged + reason.modified + reason.untracked;
        // A tree Git reports as not clean while the counted lists are all empty - a
        // conflict, a detached HEAD, a rename in progress - has no figure to name.
        if (total === 0) return t("dashboard.widgets.attention.reasons.notClean");
        const parts = [
          reason.staged > 0 ? t("dashboard.widgets.attention.reasons.staged", { count: reason.staged }) : null,
          reason.modified > 0 ? t("dashboard.widgets.attention.reasons.modified", { count: reason.modified }) : null,
          reason.untracked > 0 ? t("dashboard.widgets.attention.reasons.untracked", { count: reason.untracked }) : null
        ].filter(Boolean);
        return `${t("dashboard.widgets.attention.reasons.changes", { count: total })} (${parts.join(", ")})`;
      }
      case "ahead":
        return t("dashboard.widgets.attention.reasons.ahead", { count: reason.count });
    }
  }).join(" · ");
}
