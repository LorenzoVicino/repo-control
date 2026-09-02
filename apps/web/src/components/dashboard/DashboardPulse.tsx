import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha, Box, ButtonBase, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";
import type { DashboardSnapshot } from "./dashboardSnapshot";

type DashboardPulseProps = {
  projects: ProjectSummary[];
  snapshot: DashboardSnapshot;
  onOpenProject: (projectId: string) => void;
};

type SignalTone = "error" | "warning" | "info" | "success";

type OperationalSignal = {
  key: "blocked" | "action" | "ahead" | "ready";
  labelKey:
    | "dashboard.pulse.blocked"
    | "dashboard.pulse.action"
    | "dashboard.pulse.ahead"
    | "dashboard.pulse.readySignal";
  count: number;
  tone: SignalTone;
};

const DONUT_SIZE = 138;
const DONUT_STROKE = 16;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
// The same 2px surface gap the change bars use, measured along the arc.
const DONUT_GAP = 2;

type ChangeKind = "staged" | "modified" | "untracked";

// staged -> modified -> untracked is a pipeline towards a commit, not three unrelated
// categories, so it takes one hue in three ordered steps rather than three status colors.
// Every palette already carries those steps, and the error and warning tokens stay
// available for states that are actually wrong.
const CHANGE_KINDS: ReadonlyArray<{
  key: ChangeKind;
  labelKey: "dashboard.pulse.staged" | "dashboard.pulse.modified" | "dashboard.pulse.untracked";
  step: "light" | "main" | "dark";
}> = [
  { key: "staged", labelKey: "dashboard.pulse.staged", step: "light" },
  { key: "modified", labelKey: "dashboard.pulse.modified", step: "main" },
  { key: "untracked", labelKey: "dashboard.pulse.untracked", step: "dark" }
];

export function DashboardPulse({ projects, snapshot, onOpenProject }: DashboardPulseProps) {
  const { t, i18n } = useTranslation();
  const signals = buildOperationalSignals(projects);
  const signalDescription = signals
    .filter((signal) => signal.count > 0)
    .map((signal) => `${signal.count} ${t(signal.labelKey).toLocaleLowerCase(i18n.resolvedLanguage)}`)
    .join(", ");
  // Grouped bars compare one file state against the same state elsewhere, so the scale is
  // the largest single state in the list rather than the largest repository total.
  const maxChangeValue = Math.max(
    1,
    ...snapshot.changeLoad.flatMap(({ project }) => [project.staged, project.modified, project.untracked])
  );

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
              label={t("dashboard.pulse.distribution", { description: signalDescription })}
            />

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
            {CHANGE_KINDS.map((kind) => (
              <ChangeLegend key={kind.key} kind={kind.key} label={t(kind.labelKey)} />
            ))}
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
          <>
            <Stack spacing={0.3} sx={{ mt: 1.1 }}>
              {snapshot.changeLoad.map(({ project, total }) => (
                <ChangeLoadRow
                  key={project.id}
                  project={project}
                  total={total}
                  maxValue={maxChangeValue}
                  onOpen={() => onOpenProject(project.id)}
                />
              ))}
            </Stack>
            <Typography
              color="text.disabled"
              sx={{ mt: 1, textAlign: "right", fontFamily: "var(--rc-font-mono)", fontSize: 9 }}
            >
              {t("dashboard.pulse.changeScale", { max: maxChangeValue })}
            </Typography>
          </>
        )}
      </Box>
    </Box>
  );
}

// One ring, four arcs, and the readiness figure in the hole - which is the reason to use a
// ring rather than a bar here: the headline number stops floating in its own corner.
function SignalDonut({
  signals,
  total,
  ready,
  readyPercentage,
  label
}: {
  signals: OperationalSignal[];
  total: number;
  ready: number;
  readyPercentage: number;
  label: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const visibleSignals = signals.filter((signal) => signal.count > 0);
  const center = DONUT_SIZE / 2;
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

          return (
            <circle
              key={signal.key}
              data-signal-key={signal.key}
              cx={center}
              cy={center}
              r={DONUT_RADIUS}
              fill="none"
              stroke={theme.palette[signal.tone].main}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${drawn} ${DONUT_CIRCUMFERENCE - drawn}`}
              transform={`rotate(${rotation} ${center} ${center})`}
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
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 26, fontWeight: 500, lineHeight: 1 }}>
            {readyPercentage}%
          </Typography>
          <Typography component="div" variant="overline" color="text.secondary" sx={{ lineHeight: 1.5 }}>
            {t("dashboard.pulse.ready")}
          </Typography>
          <Typography component="div" color="text.disabled" sx={{ fontSize: 9.5, lineHeight: 1.3 }}>
            {t("dashboard.pulse.readyOf", { ready, total })}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function SignalLegendItem({ signal }: { signal: OperationalSignal }) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
      <Box
        aria-hidden="true"
        sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: `${signal.tone}.main`, flexShrink: 0 }}
      />
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
  maxValue,
  onOpen
}: {
  project: ProjectSummary;
  total: number;
  maxValue: number;
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
        minHeight: 44,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(86px, 0.7fr) minmax(104px, 1.3fr) 30px", sm: "minmax(116px, 0.68fr) minmax(180px, 1.32fr) 30px" },
        gap: 1,
        alignItems: "center",
        px: 0.6,
        py: 0.5,
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
      <Stack
        spacing={0.5}
        role="img"
        aria-label={t("dashboard.pulse.changesAria", {
          staged: project.staged,
          modified: project.modified,
          untracked: project.untracked
        })}
      >
        {CHANGE_KINDS.map((kind) => (
          <ChangeBar
            key={kind.key}
            kind={kind.key}
            label={t(kind.labelKey)}
            value={project[kind.key]}
            maxValue={maxValue}
          />
        ))}
      </Stack>
      <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
        <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5, fontWeight: 600 }}>{total}</Typography>
        <OpenInNewRoundedIcon sx={{ fontSize: 12, color: "text.disabled" }} />
      </Stack>
    </ButtonBase>
  );
}

// An empty track is drawn on purpose: a repository with nothing staged should show that it
// has nothing staged, and it keeps the three bars aligned from one row to the next.
function ChangeBar({
  kind,
  label,
  value,
  maxValue
}: {
  kind: ChangeKind;
  label: string;
  value: number;
  maxValue: number;
}) {
  const { t, i18n } = useTranslation();
  const readout = t("dashboard.pulse.kindCount", {
    count: value,
    kind: label.toLocaleLowerCase(i18n.resolvedLanguage)
  });

  return (
    <Tooltip title={readout} placement="top" disableInteractive>
      <Box
        data-change-kind={kind}
        sx={{ height: 6, borderRadius: 999, bgcolor: "var(--rc-surface-3)", overflow: "hidden" }}
      >
        {value > 0 ? (
          <Box
            sx={{
              height: "100%",
              width: `${(value / maxValue) * 100}%`,
              minWidth: 3,
              borderRadius: 999,
              bgcolor: (theme) => getChangeColor(theme, kind)
            }}
          />
        ) : null}
      </Box>
    </Tooltip>
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
  const step = CHANGE_KINDS.find((candidate) => candidate.key === kind)?.step ?? "main";
  return theme.palette.primary[step];
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
