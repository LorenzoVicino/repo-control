import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { keyframes } from "@emotion/react";
import { alpha, Box, ButtonBase, Stack, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import React from "react";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";
import type { DashboardSnapshot } from "./dashboardSnapshot";

type DashboardPulseProps = {
  projects: ProjectSummary[];
  snapshot: DashboardSnapshot;
  onOpenProject: (projectId: string) => void;
};

type SignalKey = "blocked" | "action" | "ahead" | "ready";

type OperationalSignal = {
  key: SignalKey;
  labelKey:
    | "dashboard.pulse.blocked"
    | "dashboard.pulse.action"
    | "dashboard.pulse.ahead"
    | "dashboard.pulse.readySignal";
  count: number;
  tone: "error" | "warning" | "info" | "success";
};

const flowSignal = keyframes`
  from { background-position: 0 0; }
  to { background-position: 28px 0; }
`;

const DONUT_SIZE = 138;
const DONUT_STROKE = 16;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
// A 2px surface gap between arcs, measured along the circumference.
const DONUT_GAP = 2;

export function DashboardPulse({ projects, snapshot, onOpenProject }: DashboardPulseProps) {
  const { t, i18n } = useTranslation();
  const [activeSignal, setActiveSignal] = React.useState<SignalKey | null>(null);
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
        <Box>
          <Typography variant="overline" color="primary.light">{t("dashboard.pulse.snapshot")}</Typography>
          <Typography id="workspace-pulse-title" component="h2" variant="h2" sx={{ mt: 0.2 }}>
            {t("dashboard.pulse.title")}
          </Typography>
        </Box>

        {snapshot.total > 0 ? (
          <>
            <SignalDonut
              signals={signals}
              total={snapshot.total}
              ready={snapshot.healthy}
              readyPercentage={snapshot.healthPercentage}
              activeSignal={activeSignal}
              onActiveSignalChange={setActiveSignal}
              label={t("dashboard.pulse.distribution", { description: signalDescription })}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: 1.6 }}>
              {signals.map((signal) => (
                <SignalLegendItem
                  key={signal.key}
                  signal={signal}
                  isActive={activeSignal === signal.key}
                  isDimmed={activeSignal !== null && activeSignal !== signal.key && signal.count > 0}
                  isInteractive={signal.count > 0}
                  onHoverChange={(hovering) => setActiveSignal(hovering ? signal.key : null)}
                />
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

// The readiness figure lives in the hole, and pointing at a state puts that state's own
// count there instead - so a per-state number needs no second place to look.
function SignalDonut({
  signals,
  total,
  ready,
  readyPercentage,
  activeSignal,
  onActiveSignalChange,
  label
}: {
  signals: OperationalSignal[];
  total: number;
  ready: number;
  readyPercentage: number;
  activeSignal: SignalKey | null;
  onActiveSignalChange: (key: SignalKey | null) => void;
  label: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const visibleSignals = signals.filter((signal) => signal.count > 0);
  const center = DONUT_SIZE / 2;
  const focused = signals.find((signal) => signal.key === activeSignal) ?? null;
  let travelled = 0;

  return (
    <Box sx={{ position: "relative", width: DONUT_SIZE, height: DONUT_SIZE, mx: "auto", mt: 1.9 }}>
      <Box
        component="svg"
        role="img"
        aria-label={label}
        viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
        sx={{ display: "block", width: "100%", height: "100%" }}
      >
        <circle
          cx={center}
          cy={center}
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--rc-surface-3)"
          strokeWidth={DONUT_STROKE}
        />
        {visibleSignals.map((signal) => {
          const share = signal.count / total;
          const arc = share * DONUT_CIRCUMFERENCE;
          // A lone arc closes the ring, so it takes no gap; anything else gives one back.
          const drawn = visibleSignals.length > 1 ? Math.max(arc - DONUT_GAP, 1) : arc;
          const rotation = -90 + travelled * 360;
          travelled += share;
          const isActive = activeSignal === signal.key;
          const isDimmed = activeSignal !== null && !isActive;

          return (
            <circle
              key={signal.key}
              data-signal-key={signal.key}
              data-active={isActive ? "true" : undefined}
              cx={center}
              cy={center}
              r={DONUT_RADIUS}
              fill="none"
              stroke={theme.palette[signal.tone].main}
              strokeWidth={isActive ? DONUT_STROKE + 4 : DONUT_STROKE}
              strokeDasharray={`${drawn} ${DONUT_CIRCUMFERENCE - drawn}`}
              transform={`rotate(${rotation} ${center} ${center})`}
              opacity={isDimmed ? 0.32 : 1}
              onMouseEnter={() => onActiveSignalChange(signal.key)}
              onMouseLeave={() => onActiveSignalChange(null)}
              style={{
                cursor: "default",
                transition: "stroke-width var(--rc-motion-fast) ease, opacity var(--rc-motion-fast) ease"
              }}
            />
          );
        })}
      </Box>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          pointerEvents: "none"
        }}
      >
        <Box data-testid="signal-readout" sx={{ minWidth: 0, px: 2.5 }}>
          <Typography
            sx={{
              color: focused ? `${focused.tone}.main` : "text.primary",
              fontFamily: "var(--rc-font-mono)",
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1
            }}
          >
            {focused ? focused.count : `${readyPercentage}%`}
          </Typography>
          <Typography
            component="div"
            variant="overline"
            color="text.secondary"
            sx={{ lineHeight: 1.5, whiteSpace: "normal" }}
          >
            {focused ? t(focused.labelKey) : t("dashboard.pulse.ready")}
          </Typography>
          {focused ? null : (
            <Typography component="div" color="text.disabled" sx={{ fontSize: 9.5, lineHeight: 1.3 }}>
              {t("dashboard.pulse.readyOf", { ready, total })}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function SignalLegendItem({
  signal,
  isActive,
  isDimmed,
  isInteractive,
  onHoverChange
}: {
  signal: OperationalSignal;
  isActive: boolean;
  isDimmed: boolean;
  isInteractive: boolean;
  onHoverChange: (hovering: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.8}
      data-signal-legend={signal.key}
      onMouseEnter={isInteractive ? () => onHoverChange(true) : undefined}
      onMouseLeave={isInteractive ? () => onHoverChange(false) : undefined}
      sx={{
        minWidth: 0,
        px: 0.5,
        py: 0.2,
        mx: -0.5,
        borderRadius: "var(--rc-radius-control)",
        bgcolor: isActive ? "var(--rc-surface-2)" : "transparent",
        opacity: isDimmed ? 0.5 : 1,
        transition: "background-color var(--rc-motion-fast) ease, opacity var(--rc-motion-fast) ease"
      }}
    >
      <Box
        aria-hidden="true"
        sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: `${signal.tone}.main`, flexShrink: 0 }}
      />
      <Typography
        variant="caption"
        color={isActive ? "text.primary" : "text.secondary"}
        noWrap
        sx={{ minWidth: 0, flexGrow: 1 }}
      >
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
    { key: "blocked", labelKey: "dashboard.pulse.blocked", count: counts.blocked, tone: "error" },
    { key: "action", labelKey: "dashboard.pulse.action", count: counts.action, tone: "warning" },
    { key: "ahead", labelKey: "dashboard.pulse.ahead", count: counts.ahead, tone: "info" },
    { key: "ready", labelKey: "dashboard.pulse.readySignal", count: counts.ready, tone: "success" }
  ];
}
