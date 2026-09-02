import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import { Alert, Box, Button, CircularProgress, Stack, Typography, useTheme } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchAgentSessions, resumeAgentSession } from "../../../api/agentSessions";
import type { AgentSessionProvider, AgentSessionSummary } from "../../../types/agentSessions";
import { formatRelativeTime } from "../../../utils/time";
import { ColumnChart } from "../DashboardCharts";
import { WidgetBody, WidgetEmpty, WidgetError, WidgetHeader, WidgetRow, WidgetRowsSkeleton, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

const LIMIT = { small: 4, medium: 5, large: 10 } as const;
const NOTICE_TIMEOUT_MS = 6000;
const ACTIVITY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

type Notice = { severity: "success" | "error"; message: string };

// The same query the Agent sessions page runs with an empty search, so the two share one
// scan and moving from here to there costs nothing.
export function ChatsWidget({ size, titleId, context }: DashboardWidgetProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = i18n.resolvedLanguage ?? i18n.language;
  const [resumingKey, setResumingKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["agent-sessions", ""],
    queryFn: () => fetchAgentSessions("", t("agents.detectError")),
    staleTime: 30 * 1000
  });
  const allSessions = React.useMemo(() => dedupe(data?.sessions ?? []), [data?.sessions]);
  const sessions = React.useMemo(() => sortByRecentUse(allSessions).slice(0, LIMIT[size]), [allSessions, size]);
  // Conversations touched per day over the last two weeks, today at the right edge.
  const activity = React.useMemo(() => {
    const today = startOfDay(Date.now());
    const buckets = Array.from({ length: ACTIVITY_DAYS }, (_, index) => ({ day: today - (ACTIVITY_DAYS - 1 - index) * DAY_MS, count: 0 }));
    for (const session of allSessions) {
      const day = startOfDay(getTimestamp(session));
      const bucket = buckets.find((entry) => entry.day === day);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  }, [allSessions]);
  const activeDays = activity.filter((bucket) => bucket.count > 0).length;
  const todayCount = activity[activity.length - 1]?.count ?? 0;
  const dayFormatter = React.useMemo(() => new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short" }), [language]);
  const installedById = React.useMemo(() => new Map(data?.agents.map((agent) => [agent.id, agent.installed]) ?? []), [data?.agents]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function resume(session: AgentSessionSummary) {
    const key = getKey(session);
    setResumingKey(key);
    setNotice(null);
    try {
      const result = await resumeAgentSession(session.provider, session.id, session.projectId, t("agents.resumeError"));
      setNotice({ severity: "success", message: result.message });
    } catch (resumeError) {
      setNotice({ severity: "error", message: resumeError instanceof Error ? resumeError.message : t("agents.resumeError") });
    } finally {
      setResumingKey(null);
    }
  }

  const totalCount = data?.sessions.length ?? 0;

  return (
    <>
      <WidgetHeader
        titleId={titleId}
        title={t("dashboard.widgets.chats.title")}
        meta={totalCount > 0 ? t("dashboard.widgets.chats.sessionCount", { count: totalCount }) : undefined}
        action={{ label: t("dashboard.widgets.chats.all"), onClick: () => context.onNavigate("agents") }}
      />
      {isLoading ? (
        <WidgetRowsSkeleton rows={3} label={t("dashboard.widgets.chats.loading")} />
      ) : error ? (
        <WidgetError
          message={error instanceof Error ? error.message : t("agents.detectError")}
          onRetry={() => void refetch()}
          retryLabel={t("dashboard.widgets.shared.retry")}
        />
      ) : sessions.length === 0 ? (
        <WidgetEmpty
          icon={<ForumOutlinedIcon />}
          title={t("dashboard.widgets.chats.empty")}
          hint={t("dashboard.widgets.chats.emptyHint")}
        />
      ) : (
        <>
          <Box sx={{ px: 1.5, pt: 1, pb: 0.9, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "baseline" }} spacing={{ xs: 0, sm: 1 }} sx={{ mb: 0.6 }}>
              <Typography variant="caption" sx={{ fontWeight: 500, flexGrow: 1 }}>
                {t("dashboard.widgets.chats.activityTitle", { days: ACTIVITY_DAYS })}
              </Typography>
              <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10, color: "text.secondary" }}>
                {t("dashboard.widgets.chats.today", { count: todayCount })} · {t("dashboard.widgets.chats.activeDays", { count: activeDays })}
              </Typography>
            </Stack>
            <ColumnChart
              height={40}
              ariaLabel={t("dashboard.widgets.chats.activityAria", { days: ACTIVITY_DAYS, count: allSessions.length })}
              columns={activity.map((bucket, index) => ({
                key: String(bucket.day),
                value: bucket.count,
                color: theme.palette.primary.main,
                emphasis: index === activity.length - 1,
                title: `${dayFormatter.format(bucket.day)} · ${t("dashboard.widgets.chats.sessionCount", { count: bucket.count })}`
              }))}
            />
          </Box>
          <WidgetBody columns={size === "large" ? 2 : 1}>
          {sessions.map((session) => {
            const key = getKey(session);
            const installed = installedById.get(session.provider) !== false;
            const updated = formatRelativeTime(session.updatedAt ?? session.startedAt, language);
            return (
              <WidgetRow
                key={key}
                leading={<ProviderIcon provider={session.provider} />}
                primary={session.title}
                secondary={size === "small" ? undefined : [session.projectName, updated].filter(Boolean).join(" · ")}
                trailing={(
                  <Button
                    size="small"
                    variant="text"
                    disabled={!installed || resumingKey !== null}
                    onClick={() => void resume(session)}
                    aria-label={t("dashboard.widgets.chats.resumeAria", { title: session.title })}
                    startIcon={resumingKey === key ? <CircularProgress size={12} color="inherit" /> : undefined}
                    sx={{ minHeight: 28, px: 1 }}
                  >
                    {installed ? t("dashboard.widgets.chats.resume") : t("agents.cliUnavailable")}
                  </Button>
                )}
              />
            );
          })}
          </WidgetBody>
        </>
      )}
      {notice ? (
        <Alert severity={notice.severity} onClose={() => setNotice(null)} sx={{ m: 1, py: 0.25, flexShrink: 0, fontSize: 11.5 }}>
          {notice.message}
        </Alert>
      ) : null}
    </>
  );
}

function ProviderIcon({ provider }: { provider: AgentSessionProvider }) {
  const sx = { fontSize: 16, color: "text.secondary" };
  if (provider === "claude") return <PsychologyOutlinedIcon sx={sx} />;
  if (provider === "gemini") return <AutoAwesomeOutlinedIcon sx={sx} />;
  return <TerminalRoundedIcon sx={sx} />;
}

function startOfDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getKey(session: AgentSessionSummary): string {
  return `${session.provider}:${session.projectId}:${session.id}`;
}

function getTimestamp(session: AgentSessionSummary): number {
  const timestamp = Date.parse(session.updatedAt ?? session.startedAt ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortByRecentUse(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  return [...sessions].sort((left, right) => getTimestamp(right) - getTimestamp(left));
}

function dedupe(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  const byKey = new Map<string, AgentSessionSummary>();
  for (const session of sessions) {
    const current = byKey.get(getKey(session));
    if (!current || getTimestamp(session) > getTimestamp(current)) byKey.set(getKey(session), session);
  }
  return [...byKey.values()];
}
