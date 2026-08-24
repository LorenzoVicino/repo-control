import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CallSplitRoundedIcon from "@mui/icons-material/CallSplitRounded";
import CommitRoundedIcon from "@mui/icons-material/CommitRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  alpha,
  Box,
  Button,
  ButtonBase,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import type { DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";
import { buildDashboardSnapshot } from "./dashboardSnapshot";
import { DashboardPulse } from "./DashboardPulse";
import type { DashboardSection } from "./DashboardSidebar";

type DashboardHomeProps = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  dockerStatus: DockerContainersResponse | undefined;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject: (projectId: string) => void;
};

type Quote = { text: string; author: string };

const LAST_QUOTE_STORAGE_KEY = "repo-control-last-dashboard-quote";
const QUOTES: Quote[] = [
  { text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.", author: "Alan Turing" },
  { text: "The Analytical Engine has no pretensions whatever to originate anything.", author: "Ada Lovelace" },
  { text: "Testing shows the presence, not the absence of bugs.", author: "Edsger W. Dijkstra" },
  { text: "Premature optimization is the root of all evil.", author: "Donald Knuth" },
  { text: "What I cannot create, I do not understand.", author: "Richard Feynman" },
  { text: "The purpose of computing is insight, not numbers.", author: "Richard Hamming" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Talk is cheap. Show me the code.", author: "Linus Torvalds" },
  { text: "There was no choice but to be pioneers; no time to be beginners.", author: "Margaret Hamilton" }
];

export const DashboardHome = React.memo(function DashboardHome({
  projects,
  favoriteProjectIds,
  dockerStatus,
  onNavigate,
  onOpenProject
}: DashboardHomeProps) {
  const [quote, setQuote] = React.useState<Quote>(pickLocalQuote);
  const snapshot = React.useMemo(
    () => buildDashboardSnapshot(projects, favoriteProjectIds, dockerStatus),
    [dockerStatus, favoriteProjectIds, projects]
  );
  const attentionProjects = React.useMemo(
    () => projects
      .filter((project) => !project.isClean || project.behind > 0),
    [projects]
  );
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);

  React.useEffect(() => {
    window.localStorage.setItem(LAST_QUOTE_STORAGE_KEY, quote.text);
  }, [quote.text]);

  return (
    <Stack spacing={2.25} sx={{ minHeight: { md: "calc(100dvh - 102px)" } }}>
      <Box
        component="header"
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
          gap: 2,
          alignItems: "end",
          pb: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Triage workspace</Typography>
          <Typography id="dashboard-home-title" component="h1" variant="h1" sx={{ mt: 0.35 }}>
            {snapshot.total === 0
              ? "Workspace pronto per la scansione"
              : `${attentionProjects.length} di ${snapshot.total} repository richiedono attenzione`}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.7, maxWidth: 620 }}>
            Stato operativo locale: modifiche, sincronizzazione, runtime e attività recente in un solo passaggio.
          </Typography>
        </Box>
        <Stack direction="row" spacing={{ xs: 2, sm: 3.5 }} sx={{ overflowX: "auto" }}>
          <HeaderFigure value={snapshot.total} label="repository" />
          <HeaderFigure value={snapshot.healthy} label="pronti" tone="success.main" />
          <HeaderFigure value={snapshot.localChanges} label="modifiche" tone={snapshot.localChanges > 0 ? "warning.main" : undefined} />
        </Stack>
      </Box>

      <DashboardPulse
        projects={projects}
        snapshot={snapshot}
        onOpenProject={onOpenProject}
      />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(0, 1fr) 340px",
            xl: "minmax(0, 1fr) 376px"
          },
          gap: 1.5,
          minHeight: 0,
          alignItems: "start"
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <WorkbenchPanel>
            <PanelHeader
              label="Workspace ledger"
              meta={`${projects.length} repository`}
              action={(
                <Button size="small" variant="text" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onNavigate("repositories")}>
                  Esplora
                </Button>
              )}
            />
            <Box sx={{ overflowX: "auto" }}>
              <Box sx={{ minWidth: 760 }}>
                <Box
                  sx={{
                    minHeight: 32,
                    display: "grid",
                    gridTemplateColumns: "minmax(170px, 1.25fr) minmax(110px, .8fr) 78px 90px 82px minmax(200px, 1.35fr)",
                    alignItems: "center",
                    px: 1.5,
                    bgcolor: "var(--rc-surface-2)",
                    borderBottom: "1px solid",
                    borderColor: "divider"
                  }}
                >
                  {['Repository', 'Branch', 'Albero', 'Sync', 'Runtime', 'Ultimo commit'].map((label) => (
                    <Typography key={label} variant="overline" color="text.secondary">{label}</Typography>
                  ))}
                </Box>
                {projects.length > 0 ? projects.map((project) => (
                  <LedgerRow
                    key={project.id}
                    project={project}
                    favorite={favoriteProjectIdSet.has(project.id)}
                    runtime={getProjectRuntime(project, dockerStatus)}
                    onOpen={() => onOpenProject(project.id)}
                  />
                )) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                    Seleziona una cartella workspace per popolare il ledger.
                  </Typography>
                )}
              </Box>
            </Box>
          </WorkbenchPanel>
        </Stack>

        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
          <WorkbenchPanel>
            <PanelHeader label="Stato operativo" meta={`${snapshot.healthPercentage}% pronto`} />
            <Box sx={{ px: 1.5, py: 1.4 }}>
              <StatusLine
                tone={attentionProjects.length > 0 ? "warning.main" : "success.main"}
                label={attentionProjects.length > 0 ? "Intervento richiesto" : "Workspace stabile"}
              />
              <LinearProgress
                variant="determinate"
                value={snapshot.healthPercentage}
                color={attentionProjects.length > 0 ? "warning" : "success"}
                sx={{ height: 3, mt: 1.4, bgcolor: "var(--rc-surface-3)" }}
              />
              <Stack direction="row" spacing={2} sx={{ mt: 1.25 }}>
                <MiniMetric label="sporchi" value={snapshot.dirty} />
                <MiniMetric label="behind" value={snapshot.behind} />
                <MiniMetric label="ahead" value={snapshot.ahead} />
              </Stack>
            </Box>
          </WorkbenchPanel>

          <WorkbenchPanel>
            <PanelHeader label="Runtime" meta={snapshot.dockerAvailable ? "Docker online" : "non disponibile"} />
            <Box sx={{ px: 1.5, py: 1.35 }}>
              <StatusLine
                tone={snapshot.dockerAvailable ? "success.main" : "text.disabled"}
                label={snapshot.dockerAvailable ? `${snapshot.runningContainers} container in esecuzione` : "Runtime non rilevato"}
              />
              {snapshot.dockerAvailable ? (
                <Stack direction="row" spacing={2} sx={{ mt: 1.15 }}>
                  <MiniMetric label="gruppi" value={snapshot.dockerGroups} />
                  <MiniMetric label="container" value={snapshot.runningContainers} />
                </Stack>
              ) : null}
              {snapshot.dockerAvailable ? (
                <Button size="small" variant="text" sx={{ mt: 1, px: 0 }} onClick={() => onNavigate("docker")}>
                  Apri runtime
                </Button>
              ) : null}
            </Box>
          </WorkbenchPanel>

          <WorkbenchPanel>
            <PanelHeader label="Commit recenti" meta={`${snapshot.recentProjects.length} attività`} />
            <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {snapshot.recentProjects.length > 0 ? snapshot.recentProjects.map((project) => (
                <ButtonBase
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  sx={{ width: "100%", px: 1.5, py: 1.1, gap: 1, justifyContent: "flex-start", textAlign: "left", "&:hover": { bgcolor: "action.hover" } }}
                >
                  <CommitRoundedIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" noWrap component="div" sx={{ fontWeight: 500 }}>
                      {project.lastCommit?.message ?? "Nessun commit"}
                    </Typography>
                    <Typography noWrap component="div" color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>
                      {project.name} · {project.lastCommit?.hash ?? "—"}
                    </Typography>
                  </Box>
                </ButtonBase>
              )) : (
                <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>Nessun commit rilevato.</Typography>
              )}
            </Stack>
          </WorkbenchPanel>

          <Box
            component="figure"
            sx={{
              position: "relative",
              m: 0,
              p: 1.5,
              borderLeft: "2px solid",
              borderColor: "primary.main",
              bgcolor: (theme) => alpha(theme.palette.primary.main, 0.055)
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ pr: 3.5 }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: 14, color: "primary.light" }} />
              <Typography variant="overline" color="primary.light">Prospettiva</Typography>
            </Stack>
            <Tooltip title="Mostra un'altra citazione">
              <IconButton
                size="small"
                onClick={() => setQuote((currentQuote) => pickLocalQuote(currentQuote.text))}
                aria-label="Mostra un'altra citazione"
                sx={{ position: "absolute", top: 8, right: 8 }}
              >
                <ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Typography component="blockquote" variant="body2" sx={{ m: 0, mt: 1.1, lineHeight: 1.55 }}>
              “{quote.text}”
            </Typography>
            <Typography component="figcaption" color="text.secondary" sx={{ mt: 0.75, fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>
              — {quote.author}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
});

function WorkbenchPanel({ children }: React.PropsWithChildren) {
  return (
    <Box sx={{ minWidth: 0, overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: "var(--rc-radius-panel)", bgcolor: "background.paper" }}>
      {children}
    </Box>
  );
}

function PanelHeader({ label, meta, action }: { label: string; meta: string; action?: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minHeight: 38, px: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-2)" }}>
      <Typography component="h2" variant="h2" sx={{ flexGrow: 1 }}>{label}</Typography>
      <Typography color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>{meta}</Typography>
      {action}
    </Stack>
  );
}

function HeaderFigure({ value, label, tone = "text.primary" }: { value: number; label: string; tone?: string }) {
  return (
    <Box sx={{ minWidth: 62 }}>
      <Typography sx={{ color: tone, fontFamily: "var(--rc-font-mono)", fontSize: 20, fontWeight: 500, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
    </Box>
  );
}

function LedgerRow({ project, favorite, runtime, onOpen }: { project: ProjectSummary; favorite: boolean; runtime: string; onOpen: () => void }) {
  const changes = getLocalChangeCount(project);
  const treeTone = project.isClean ? "success.main" : "warning.main";

  return (
    <ButtonBase
      onClick={onOpen}
      sx={{
        width: "100%",
        minHeight: 44,
        display: "grid",
        gridTemplateColumns: "minmax(170px, 1.25fr) minmax(110px, .8fr) 78px 90px 82px minmax(200px, 1.35fr)",
        alignItems: "center",
        px: 1.5,
        textAlign: "left",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": { borderBottom: 0 },
        "&:hover": { bgcolor: "action.hover" }
      }}
    >
      <Stack direction="row" spacing={0.9} alignItems="center" sx={{ minWidth: 0 }}>
        <AccountTreeOutlinedIcon sx={{ fontSize: 16, color: treeTone, flexShrink: 0 }} />
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{project.name}</Typography>
        {favorite ? <StarRoundedIcon sx={{ fontSize: 12, color: "warning.main", flexShrink: 0 }} /> : null}
      </Stack>
      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
        <CallSplitRoundedIcon sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0 }} />
        <Typography noWrap sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5 }}>{project.branch}</Typography>
      </Stack>
      <StatusLine tone={treeTone} label={project.isClean ? "pulito" : `${changes} mod.`} compact />
      <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10, color: project.behind > 0 ? "warning.main" : "text.secondary" }}>
        ↑{project.ahead} · ↓{project.behind}
      </Typography>
      <Stack direction="row" spacing={0.55} alignItems="center">
        <Inventory2OutlinedIcon sx={{ fontSize: 13, color: runtime === "running" ? "success.main" : "text.disabled" }} />
        <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5, color: "text.secondary" }}>{runtime}</Typography>
      </Stack>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" noWrap component="div">{project.lastCommit?.message ?? "Nessun commit"}</Typography>
        <Typography noWrap component="div" color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9 }}>{project.lastCommit?.hash ?? "—"}</Typography>
      </Box>
    </ButtonBase>
  );
}

function StatusLine({ tone, label, compact = false }: { tone: string; label: string; compact?: boolean }) {
  return (
    <Stack direction="row" spacing={0.65} alignItems="center" sx={{ minWidth: 0 }}>
      <Box aria-hidden="true" sx={{ width: compact ? 5 : 7, height: compact ? 5 : 7, borderRadius: "50%", bgcolor: tone, flexShrink: 0 }} />
      <Typography variant={compact ? "caption" : "body2"} noWrap sx={{ fontWeight: 500 }}>{label}</Typography>
    </Stack>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <Box>
      <Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 14, fontWeight: 500, lineHeight: 1.15 }}>{value}</Typography>
      <Typography variant="overline" color="text.secondary">{label}</Typography>
    </Box>
  );
}

function getLocalChangeCount(project: ProjectSummary): number {
  return project.staged + project.modified + project.untracked;
}

function getProjectRuntime(project: ProjectSummary, dockerStatus: DockerContainersResponse | undefined): string {
  if (!project.hasDockerCompose) return "—";
  if (!dockerStatus?.ok) return "offline";
  const normalizedPath = project.path.toLocaleLowerCase();
  const hasRunningGroup = dockerStatus.groups.some((group) => group.workingDir?.toLocaleLowerCase() === normalizedPath && group.containers.length > 0);
  return hasRunningGroup ? "running" : "stopped";
}

function pickLocalQuote(excludedText = window.localStorage.getItem(LAST_QUOTE_STORAGE_KEY) ?? ""): Quote {
  const excludedIndex = QUOTES.findIndex((quote) => quote.text === excludedText);
  return QUOTES[pickRandomIndex(excludedIndex)];
}

function pickRandomIndex(excludedIndex: number): number {
  if (QUOTES.length <= 1) return 0;
  const candidate = Math.floor(Math.random() * (QUOTES.length - 1));
  return candidate >= excludedIndex && excludedIndex >= 0 ? candidate + 1 : candidate;
}
