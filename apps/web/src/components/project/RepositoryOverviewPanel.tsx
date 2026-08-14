import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import CommitOutlinedIcon from "@mui/icons-material/CommitOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { alpha, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import React from "react";
import type { CommandResult } from "../../types/common";
import type { DockerComposeProjectResponse } from "../../types/docker";
import type { GitActivityCommit, GitDetails } from "../../types/git";
import type { ProjectSummary } from "../../types/projects";
import { formatDate } from "../../utils/projects";
import { ActionButton } from "../shared/ActionButton";

type RepositoryOverviewPanelProps = {
  project: ProjectSummary;
  details: GitDetails | undefined;
  commits: GitActivityCommit[];
  dockerProject: DockerComposeProjectResponse | undefined;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function RepositoryOverviewPanel({
  project,
  details,
  commits,
  dockerProject,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onResult,
  onCompleted
}: RepositoryOverviewPanelProps) {
  const staged = details?.status.files.staged.length ?? project.staged;
  const unstaged = details?.status.files.unstaged.length ?? project.modified + project.untracked;
  const conflicts = details?.status.files.unstaged.filter((file) => file.status === "conflicted").length ?? 0;
  const runningServices = dockerProject?.services.filter((service) => service.state.toLowerCase() === "running").length ?? 0;
  const unhealthyServices = dockerProject?.services.filter((service) => service.health === "unhealthy").length ?? 0;
  const totalServices = dockerProject?.services.length ?? 0;
  const attentionItems = getAttentionItems(details, conflicts, unhealthyServices);
  const canStartDocker = project.hasDockerCompose && dockerProject?.ok === true && runningServices === 0;
  const canStopDocker = project.hasDockerCompose && dockerProject?.ok === true && runningServices > 0;

  return (
    <Stack spacing={2}>
      {attentionItems.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderColor: (theme) => alpha(theme.palette.warning.main, 0.45),
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.055)
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <ErrorOutlineIcon color="warning" fontSize="small" sx={{ mt: 0.15 }} />
            <Box>
              <Typography variant="subtitle1">Richiede attenzione</Typography>
              <Stack component="ul" spacing={0.35} sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                {attentionItems.map((item) => (
                  <Typography key={item} component="li" variant="body2" color="text.secondary">
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleOutlineIcon color="success" fontSize="small" />
            <Box>
              <Typography variant="subtitle1">Repository in ordine</Typography>
              <Typography variant="body2" color="text.secondary">Nessun blocco operativo rilevato.</Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
          gap: 1.25
        }}
      >
        <OverviewMetric
          icon={<CodeOutlinedIcon />}
          label="Working tree"
          value={staged + unstaged === 0 ? "Pulito" : `${staged + unstaged} modifiche`}
          detail={`${staged} staged · ${unstaged} unstaged`}
          tone={staged + unstaged === 0 ? "success" : "warning"}
        />
        <OverviewMetric
          icon={<CloudDownloadOutlinedIcon />}
          label="Sincronizzazione"
          value={details?.status.tracking ?? "Nessun upstream"}
          detail={`${details?.status.ahead ?? project.ahead} ahead · ${details?.status.behind ?? project.behind} behind`}
          tone={(details?.status.behind ?? project.behind) > 0 ? "warning" : "primary"}
        />
        <OverviewMetric
          icon={<Inventory2OutlinedIcon />}
          label="Docker Compose"
          value={!project.hasDockerCompose ? "Non rilevato" : `${runningServices}/${totalServices || "–"} running`}
          detail={unhealthyServices > 0 ? `${unhealthyServices} unhealthy` : dockerProject?.error ?? "Stato servizi locale"}
          tone={unhealthyServices > 0 ? "error" : runningServices > 0 ? "success" : "primary"}
        />
        <OverviewMetric
          icon={<CommitOutlinedIcon />}
          label="Ultimo commit"
          value={project.lastCommit?.message ?? "Nessun commit"}
          detail={project.lastCommit ? `${project.lastCommit.hash} · ${formatDate(project.lastCommit.date)}` : "Cronologia vuota"}
          tone="primary"
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1.15, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1">Attività recente</Typography>
              <Typography variant="caption" color="text.secondary">Cronologia Git del repository</Typography>
            </Box>
            {isLoading ? <CircularProgress size={17} /> : null}
          </Stack>
          <Stack sx={{ minHeight: 180 }}>
            {commits.length > 0 ? commits.map((commit, index) => (
              <RecentCommitRow key={commit.hash} commit={commit} isLast={index === commits.length - 1 && !hasMore} />
            )) : !isLoading ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>Nessun commit disponibile.</Typography>
            ) : null}
          </Stack>
          {hasMore ? (
            <Button fullWidth onClick={onLoadMore} disabled={isLoadingMore} sx={{ borderTop: "1px solid", borderColor: "divider", borderRadius: 0 }}>
              {isLoadingMore ? "Caricamento…" : "Mostra altri commit"}
            </Button>
          ) : null}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, alignSelf: "start" }}>
          <Typography variant="subtitle1">Azioni rapide</Typography>
          <Typography variant="caption" color="text.secondary">Comandi contestuali e sicuri</Typography>
          <Stack spacing={0.85} sx={{ mt: 1.25 }}>
            <ActionButton
              projectId={project.id}
              actionPath="open-vscode"
              label="Apri in VS Code"
              icon={<OpenInNewIcon fontSize="small" />}
              variant="contained"
              fullWidth
              onResult={onResult}
            />
            {canStartDocker ? (
              <ActionButton
                projectId={project.id}
                actionPath="docker/up"
                label="Avvia stack"
                icon={<PlayArrowIcon fontSize="small" />}
                fullWidth
                onResult={onResult}
                onCompleted={onCompleted}
              />
            ) : null}
            {canStopDocker ? (
              <ActionButton
                projectId={project.id}
                actionPath="docker/stop"
                label="Ferma stack"
                icon={<StopCircleOutlinedIcon fontSize="small" />}
                fullWidth
                onResult={onResult}
                onCompleted={onCompleted}
              />
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "success" | "warning" | "error";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.4, minWidth: 0 }}>
      <Stack direction="row" spacing={1.1} alignItems="flex-start">
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: `${tone}.main`,
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.1),
            "& svg": { fontSize: 18 }
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">{label}</Typography>
          <Typography variant="body2" noWrap title={value} sx={{ fontWeight: 500 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={detail} component="div">{detail}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function RecentCommitRow({ commit, isLast }: { commit: GitActivityCommit; isLast: boolean }) {
  return (
    <Stack
      direction="row"
      spacing={1.1}
      sx={{ px: 1.5, py: 1.1, borderBottom: isLast ? 0 : "1px solid", borderColor: "divider" }}
    >
      <Box sx={{ pt: 0.6 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="body2" noWrap sx={{ fontWeight: 500, flexGrow: 1 }}>{commit.message}</Typography>
          {commit.refs.slice(0, 2).map((ref) => <Chip key={`${commit.hash}-${ref}`} size="small" label={ref} />)}
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {commit.shortHash} · {commit.author} · {formatDate(commit.date)}
        </Typography>
      </Box>
    </Stack>
  );
}

function getAttentionItems(details: GitDetails | undefined, conflicts: number, unhealthyServices: number): string[] {
  const items: string[] = [];
  if (conflicts > 0) items.push(`${conflicts} file in conflitto bloccano le operazioni Git.`);
  if ((details?.status.behind ?? 0) > 0) items.push(`Il branch è ${details?.status.behind} commit behind rispetto all'upstream.`);
  if ((details?.status.files.unstaged.length ?? 0) > 0) items.push(`${details?.status.files.unstaged.length} modifiche non sono ancora staged.`);
  if (unhealthyServices > 0) items.push(`${unhealthyServices} servizi Docker risultano unhealthy.`);
  if (details && !details.status.tracking) items.push("Il branch corrente non ha un upstream configurato.");
  return items;
}
