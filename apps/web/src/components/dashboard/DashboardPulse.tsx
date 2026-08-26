import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { keyframes } from "@emotion/react";
import { alpha, Box, ButtonBase, Stack, Typography } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";
import type { DashboardSnapshot } from "./dashboardSnapshot";

type DashboardPulseProps = {
  projects: ProjectSummary[];
  snapshot: DashboardSnapshot;
  onOpenProject: (projectId: string) => void;
};

type OperationalSignal = {
  key: "blocked" | "action" | "ahead" | "ready";
  labelKey:
    | "dashboard.pulse.blocked"
    | "dashboard.pulse.action"
    | "dashboard.pulse.ahead"
    | "dashboard.pulse.readySignal";
  count: number;
  tone: "error.main" | "warning.main" | "info.main" | "success.main";
};

const flowSignal = keyframes`
  from { background-position: 0 0; }
  to { background-position: 28px 0; }
`;

export function DashboardPulse({ projects, snapshot, onOpenProject }: DashboardPulseProps) {
  const { t, i18n } = useTranslation();
  const signals = buildOperationalSignals(projects);
  const signalDescription = signals
    .filter((signal) => signal.count > 0)
    .map((signal) => `${signal.count} ${t(signal.labelKey).toLocaleLowerCase(i18n.resolvedLanguage)}`)
    .join(", ");
  const maxChangeLoad = Math.max(1, ...snapshot.changeLoad.map((entry) => entry.total));

  return (
    <Box
      component="section"
      aria-labelledby="workspace-pulse-title"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(280px, 0.72fr) minmax(420px, 1.28fr)" },
        minWidth: 0,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--rc-radius-panel)",
        bgcolor: "background.paper"
      }}
    >
      <Box
        sx={{
          minWidth: 0,
          p: { xs: 1.5, sm: 1.75 },
          borderBottom: { xs: "1px solid", lg: 0 },
          borderRight: { xs: 0, lg: "1px solid" },
          borderColor: "divider",
          background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.11)}, transparent 64%)`
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="overline" color="primary.light">{t("dashboard.pulse.snapshot")}</Typography>
            <Typography id="workspace-pulse-title" component="h2" variant="h2" sx={{ mt: 0.2 }}>
              {t("dashboard.pulse.title")}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 28, fontWeight: 500, lineHeight: 1 }}>
              {snapshot.healthPercentage}%
            </Typography>
            <Typography variant="overline" color="text.secondary">{t("dashboard.pulse.ready")}</Typography>
          </Box>
        </Stack>

        {snapshot.total > 0 ? (
          <>
            <Box
              role="img"
              aria-label={t("dashboard.pulse.distribution", { description: signalDescription })}
              sx={{
                display: "flex",
                gap: "2px",
                height: 11,
                mt: 2,
                overflow: "hidden",
                borderRadius: 999,
                bgcolor: "var(--rc-surface-3)"
              }}
            >
              {signals.map((signal, index) => {
                if (signal.count === 0) return null;

                const isAnimated = signal.key === "blocked" || signal.key === "action" || signal.key === "ready";

                return (
                  <Box
                    key={signal.key}
                    data-signal-key={signal.key}
                    data-animation={isAnimated ? "continuous" : "static"}
                    sx={{
                      position: "relative",
                      minWidth: 3,
                      flexGrow: signal.count,
                      flexBasis: 0,
                      overflow: "hidden",
                      bgcolor: signal.tone,
                      backgroundImage: isAnimated
                        ? "repeating-linear-gradient(120deg, transparent 0 7px, rgba(255, 255, 255, 0.2) 7px 12px, transparent 12px 20px)"
                        : "none",
                      backgroundSize: "28px 100%",
                      animation: isAnimated
                        ? `${flowSignal} 1100ms linear ${index * -180}ms infinite`
                        : "none",
                      "@media (prefers-reduced-motion: reduce)": {
                        animation: "none",
                        backgroundImage: "none"
                      }
                    }}
                  />
                );
              })}
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 1.6 }}>
              {signals.map((signal) => (
                <SignalLegendItem key={signal.key} signal={signal} />
              ))}
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t("dashboard.pulse.emptySignals")}
          </Typography>
        )}
      </Box>

      <Box sx={{ minWidth: 0, p: { xs: 1.5, sm: 1.75 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.8}>
          <Box>
            <Typography component="h3" variant="h2">{t("dashboard.pulse.changeConcentration")}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t("dashboard.pulse.changeDescription")}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.4} alignItems="center" aria-label={t("dashboard.pulse.changeLegend")}>
            <ChangeLegend kind="staged" label={t("dashboard.pulse.staged")} />
            <ChangeLegend kind="modified" label={t("dashboard.pulse.modified")} />
            <ChangeLegend kind="untracked" label={t("dashboard.pulse.untracked")} />
          </Stack>
        </Stack>

        {snapshot.changeLoad.length === 0 ? (
          <Stack direction="row" alignItems="center" spacing={0.9} sx={{ minHeight: 98, color: "success.main" }}>
            <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{t("dashboard.pulse.treesAligned")}</Typography>
              <Typography variant="caption" color="text.secondary">{t("dashboard.pulse.noLocalChanges")}</Typography>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={0.3} sx={{ mt: 1.1 }}>
            {snapshot.changeLoad.map(({ project, total }) => (
              <ChangeLoadRow
                key={project.id}
                project={project}
                total={total}
                maxTotal={maxChangeLoad}
                onOpen={() => onOpenProject(project.id)}
              />
            ))}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

function SignalLegendItem({ signal }: { signal: OperationalSignal }) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: signal.tone, flexShrink: 0 }} />
      <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
        {t(signal.labelKey)}
      </Typography>
      <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 11, fontWeight: 600 }}>
        {signal.count}
      </Typography>
    </Stack>
  );
}

function ChangeLoadRow({
  project,
  total,
  maxTotal,
  onOpen
}: {
  project: ProjectSummary;
  total: number;
  maxTotal: number;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ButtonBase
      onClick={onOpen}
      aria-label={t("dashboard.pulse.openProject", { name: project.name, count: total })}
      sx={(theme) => ({
        width: "100%",
        minWidth: 0,
        minHeight: 35,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(86px, 0.7fr) minmax(104px, 1.3fr) 30px", sm: "minmax(116px, 0.68fr) minmax(180px, 1.32fr) 30px" },
        gap: 1,
        alignItems: "center",
        px: 0.6,
        textAlign: "left",
        borderRadius: "var(--rc-radius-control)",
        transition: "background-color var(--rc-motion-fast) ease",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 }
      })}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap component="div" sx={{ fontWeight: 500 }}>
          {project.name}
        </Typography>
        <Typography noWrap component="div" color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9 }}>
          {project.branch || t("dashboard.pulse.branchNotDetected")}
        </Typography>
      </Box>
      <Box
        role="img"
        aria-label={t("dashboard.pulse.changesAria", {
          staged: project.staged,
          modified: project.modified,
          untracked: project.untracked
        })}
        sx={{ height: 8, display: "flex", overflow: "hidden", borderRadius: 999, bgcolor: "var(--rc-surface-3)" }}
      >
        <ChangeBar value={project.staged} maxTotal={maxTotal} kind="staged" />
        <ChangeBar value={project.modified} maxTotal={maxTotal} kind="modified" />
        <ChangeBar value={project.untracked} maxTotal={maxTotal} kind="untracked" />
      </Box>
      <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
        <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5, fontWeight: 600 }}>{total}</Typography>
        <OpenInNewRoundedIcon sx={{ fontSize: 12, color: "text.disabled" }} />
      </Stack>
    </ButtonBase>
  );
}

type ChangeKind = "staged" | "modified" | "untracked";

function ChangeBar({ value, maxTotal, kind }: { value: number; maxTotal: number; kind: ChangeKind }) {
  if (value === 0) return null;

  return (
    <Box
      data-change-kind={kind}
      data-animation="continuous"
      sx={(theme) => ({
        position: "relative",
        width: `${(value / maxTotal) * 100}%`,
        minWidth: 2,
        overflow: "hidden",
        bgcolor: getChangeColor(theme, kind),
        backgroundImage: "repeating-linear-gradient(120deg, transparent 0 7px, rgba(255, 255, 255, 0.22) 7px 12px, transparent 12px 20px)",
        backgroundSize: "28px 100%",
        animation: `${flowSignal} 1100ms linear ${getChangeFlowDelay(kind)}ms infinite`,
        "@media (prefers-reduced-motion: reduce)": {
          animation: "none",
          backgroundImage: "none"
        }
      })}
    />
  );
}

function ChangeLegend({ kind, label }: { kind: ChangeKind; label: string }) {
  return (
    <Stack direction="row" spacing={0.55} alignItems="center">
      <Box aria-hidden="true" sx={(theme) => ({ width: 9, height: 7, borderRadius: 0.4, bgcolor: getChangeColor(theme, kind) })} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

function getChangeColor(theme: Theme, kind: ChangeKind): string {
  if (kind === "staged") return theme.palette.primary.main;
  if (kind === "untracked") return theme.palette.error.main;
  return theme.palette.warning.main;
}

function getChangeFlowDelay(kind: ChangeKind): number {
  if (kind === "modified") return -180;
  if (kind === "untracked") return -360;
  return 0;
}

function buildOperationalSignals(projects: ProjectSummary[]): OperationalSignal[] {
  const counts = projects.reduce(
    (result, project) => {
      if (project.behind > 0 && !project.isClean) result.blocked += 1;
      else if (project.behind > 0 || !project.isClean) result.action += 1;
      else if (project.ahead > 0) result.ahead += 1;
      else result.ready += 1;
      return result;
    },
    { blocked: 0, action: 0, ahead: 0, ready: 0 }
  );

  return [
    { key: "blocked", labelKey: "dashboard.pulse.blocked", count: counts.blocked, tone: "error.main" },
    { key: "action", labelKey: "dashboard.pulse.action", count: counts.action, tone: "warning.main" },
    { key: "ahead", labelKey: "dashboard.pulse.ahead", count: counts.ahead, tone: "info.main" },
    { key: "ready", labelKey: "dashboard.pulse.readySignal", count: counts.ready, tone: "success.main" }
  ];
}
