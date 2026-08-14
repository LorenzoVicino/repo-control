import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import type { DockerContainer, DockerContainerGroup, DockerContainersResponse } from "../../types/docker";

const MAX_VISIBLE_GROUPS = 5;

type ControlCenterProps = {
  dockerStatus: DockerContainersResponse | undefined;
  isLoadingDocker: boolean;
  isRefreshingDocker: boolean;
  stoppingDockerGroupId: string | null;
  dockerActionError: string | null;
  onRefreshDocker: () => void;
  onStopDockerGroup: (group: DockerContainerGroup) => void;
};

export function ControlCenter({
  dockerStatus,
  isLoadingDocker,
  isRefreshingDocker,
  stoppingDockerGroupId,
  dockerActionError,
  onRefreshDocker,
  onStopDockerGroup
}: ControlCenterProps) {
  const [showAllGroups, setShowAllGroups] = React.useState(false);
  const [pendingStopGroup, setPendingStopGroup] = React.useState<DockerContainerGroup | null>(null);
  const dockerGroups = dockerStatus?.groups ?? [];
  const visibleDockerGroups = showAllGroups ? dockerGroups : dockerGroups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenDockerGroupCount = dockerGroups.length - visibleDockerGroups.length;
  const dockerStateLabel = getDockerStateLabel(dockerStatus, isLoadingDocker);
  const dockerStateColor = dockerStatus?.ok ? "success" : dockerStatus ? "warning" : "default";
  const containers = dockerStatus?.containers ?? [];
  const attentionCount = containers.filter((container) => getContainerState(container).tone !== "success").length;
  const publishedPortCount = new Set(containers.flatMap((container) => getPublishedPorts(container.ports).map((port) => port.label))).size;

  return (
    <Box component="section" aria-labelledby="docker-runtime-title" sx={{ minWidth: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ sm: "center" }} justifyContent="space-between">
        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              borderRadius: 1,
              color: "secondary.main",
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.1)
            }}
          >
            <StorageIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography id="docker-runtime-title" component="h1" variant="h1">
                Docker runtime
              </Typography>
              <Chip size="small" label={dockerStateLabel} color={dockerStateColor} variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div">
              Stato reale del daemon, scope Compose, servizi e porte pubblicate
            </Typography>
          </Box>
        </Stack>

        <Tooltip title="Aggiorna container Docker">
          <span>
            <IconButton
              size="small"
              aria-label="Aggiorna container Docker"
              onClick={onRefreshDocker}
              disabled={isRefreshingDocker}
            >
              {isRefreshingDocker ? <CircularProgress size={17} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {dockerStatus?.ok ? (
        <Box
          aria-label="Riepilogo Docker"
          sx={{
            mt: 1.5,
            display: "grid",
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "var(--rc-surface-1)"
          }}
        >
          <RuntimeMetric label="Gruppi" value={dockerGroups.length} />
          <RuntimeMetric label="Servizi" value={containers.length} />
          <RuntimeMetric label="Da controllare" value={attentionCount} tone={attentionCount > 0 ? "warning.main" : "success.main"} />
          <RuntimeMetric label="Porte pubblicate" value={publishedPortCount} />
        </Box>
      ) : null}

      <Box sx={{ mt: 1.5 }}>
        {dockerStatus?.error ? (
          <Alert severity="warning">{dockerStatus.error}</Alert>
        ) : visibleDockerGroups.length > 0 ? (
          <Stack spacing={1}>
            {dockerActionError ? <Alert severity="error">{dockerActionError}</Alert> : null}
            <Stack spacing={0.75}>
              {visibleDockerGroups.map((group, index) => (
                <DockerProjectGroup
                  key={group.id}
                  group={group}
                  defaultExpanded={index === 0}
                  isStopping={stoppingDockerGroupId === group.id}
                  onRequestStop={() => setPendingStopGroup(group)}
                />
              ))}
            </Stack>
            {hiddenDockerGroupCount > 0 ? (
              <Button variant="outlined" onClick={() => setShowAllGroups(true)} sx={{ alignSelf: "flex-start" }}>
                Mostra {hiddenDockerGroupCount} {hiddenDockerGroupCount === 1 ? "altro gruppo" : "altri gruppi"}
              </Button>
            ) : showAllGroups && dockerGroups.length > MAX_VISIBLE_GROUPS ? (
              <Button variant="text" onClick={() => setShowAllGroups(false)} sx={{ alignSelf: "flex-start" }}>
                Mostra meno gruppi
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              minHeight: 58,
              px: 1.5,
              color: "text.secondary",
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 1,
              bgcolor: "background.paper"
            }}
          >
            {isLoadingDocker ? <CircularProgress size={17} /> : <PlayCircleOutlineIcon fontSize="small" />}
            <Typography variant="body2">
              {isLoadingDocker ? "Lettura container Docker" : "Nessun container avviato"}
            </Typography>
          </Stack>
        )}
      </Box>

      <Dialog open={Boolean(pendingStopGroup)} onClose={() => setPendingStopGroup(null)} maxWidth="xs" fullWidth>
        {pendingStopGroup ? (
          <>
            <DialogTitle>Conferma arresto gruppo</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                Stai per fermare {formatServiceCount(pendingStopGroup.containers.length)} nel gruppo {pendingStopGroup.name}. Gli altri gruppi Docker non verranno toccati.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingStopGroup(null)}>Annulla</Button>
              <Button
                color="warning"
                variant="contained"
                onClick={() => {
                  onStopDockerGroup(pendingStopGroup);
                  setPendingStopGroup(null);
                }}
              >
                Ferma {formatServiceCount(pendingStopGroup.containers.length)}
              </Button>
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </Box>
  );
}

function RuntimeMetric({ label, value, tone = "text.primary" }: { label: string; value: number; tone?: string }) {
  return (
    <Box sx={{ px: 1.5, py: 1.25, borderRight: "1px solid", borderBottom: { xs: "1px solid", md: 0 }, borderColor: "divider", "&:last-child": { borderRight: 0 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h3" color={tone} sx={{ mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

type DockerProjectGroupProps = {
  group: DockerContainerGroup;
  defaultExpanded: boolean;
  isStopping: boolean;
  onRequestStop: () => void;
};

function DockerProjectGroup({ group, defaultExpanded, isStopping, onRequestStop }: DockerProjectGroupProps) {
  const attentionCount = group.containers.filter((container) => getContainerState(container).tone !== "success").length;
  const groupHealthy = attentionCount === 0;

  return (
    <Accordion defaultExpanded={defaultExpanded} variant="outlined" disableGutters sx={{ "&:before": { display: "none" }, overflow: "hidden" }}>
      <Box sx={{ position: "relative", bgcolor: "var(--rc-surface-1)" }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minWidth: 0, pr: 10 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: groupHealthy ? "success.main" : "warning.main",
              boxShadow: (theme) => `0 0 0 3px ${alpha(groupHealthy ? theme.palette.success.main : theme.palette.warning.main, 0.12)}`,
              flexShrink: 0
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{group.name}</Typography>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {group.workingDir ?? (group.composeProject ? `Compose · ${group.composeProject}` : "Container indipendente")}
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" color={groupHealthy ? "success" : "warning"} label={formatServiceCount(group.containers.length)} />
        </Stack>
      </AccordionSummary>
      <Tooltip title={`Ferma solo ${group.name}`}>
        <span style={{ position: "absolute", right: 44, top: "50%", transform: "translateY(-50%)" }}>
          <IconButton
            size="small"
            color="warning"
            aria-label={group.composeProject ? `Ferma compose ${group.name}` : `Ferma container ${group.name}`}
            onClick={onRequestStop}
            disabled={isStopping}
          >
            {isStopping ? <CircularProgress color="inherit" size={15} /> : <StopCircleIcon fontSize="small" />}
          </IconButton>
        </span>
      </Tooltip>
      </Box>
      <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
        <Stack divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}>
          {group.containers.map((container) => <DockerServiceRow key={container.id} container={container} />)}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function DockerServiceRow({ container }: { container: DockerContainer }) {
  const state = getContainerState(container);
  const ports = getPublishedPorts(container.ports);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(180px, 0.9fr) minmax(170px, 1fr) minmax(220px, 1.2fr)" }, gap: { xs: 1, md: 1.5 }, px: 1.5, py: 1.25, alignItems: "center" }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={650} noWrap>{container.composeService ?? container.name}</Typography>
        <Typography variant="caption" color="text.secondary" component="div" noWrap>{container.image}</Typography>
      </Box>
      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip size="small" color={state.tone} variant="outlined" label={state.label} />
        <Typography variant="caption" color="text.secondary">{container.runningFor}</Typography>
      </Stack>
      <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
        {ports.length > 0 ? ports.map((port) => port.url ? (
          <Link key={port.label} href={port.url} target="_blank" rel="noreferrer" underline="hover" sx={{ display: "inline-flex", alignItems: "center", gap: 0.35, fontFamily: "var(--rc-font-mono)", fontSize: 12 }}>
            {port.label}<LaunchOutlinedIcon sx={{ fontSize: 13 }} />
          </Link>
        ) : (
          <Typography key={port.label} variant="caption" sx={{ fontFamily: "var(--rc-font-mono)" }}>{port.label}</Typography>
        )) : <Typography variant="caption" color="text.secondary">Nessuna porta pubblicata</Typography>}
      </Stack>
    </Box>
  );
}

function getContainerState(container: DockerContainer): { label: string; tone: "success" | "warning" | "error" | "default" } {
  const normalized = container.status.toLowerCase();
  if (normalized.includes("unhealthy") || normalized.includes("dead") || normalized.includes("exited")) return { label: normalized.includes("unhealthy") ? "Unhealthy" : "Arrestato", tone: "error" };
  if (normalized.includes("restarting") || normalized.includes("starting")) return { label: "In avvio", tone: "warning" };
  if (normalized.includes("healthy")) return { label: "Healthy", tone: "success" };
  if (normalized.startsWith("up")) return { label: "In esecuzione", tone: "success" };
  return { label: container.status || "Sconosciuto", tone: "default" };
}

type PublishedPort = { label: string; url: string | null };

function getPublishedPorts(rawPorts: string): PublishedPort[] {
  const seen = new Set<string>();
  return rawPorts.split(",").map((port) => port.trim()).filter(Boolean).flatMap((port) => {
    const match = port.match(/(?:^|:)(\d+)->(\d+)\/(tcp|udp)$/i);
    const label = match ? `${match[1]}→${match[2]}/${match[3].toLowerCase()}` : port;
    if (seen.has(label)) return [];
    seen.add(label);
    const published = match ? Number(match[1]) : null;
    const protocol = match?.[3].toLowerCase();
    const isWebPort = published !== null && protocol === "tcp" && [80, 443, 3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8888].includes(published);
    return [{ label, url: isWebPort ? `${published === 443 ? "https" : "http"}://localhost:${published}` : null }];
  });
}

function getDockerStateLabel(
  dockerStatus: DockerContainersResponse | undefined,
  isLoadingDocker: boolean
): string {
  if (isLoadingDocker && !dockerStatus) return "lettura";
  if (!dockerStatus) return "n/d";
  if (!dockerStatus.ok) return "non disponibile";
  return `${dockerStatus.groups.length} ${dockerStatus.groups.length === 1 ? "progetto" : "progetti"}`;
}

function formatServiceCount(count: number): string {
  return `${count} ${count === 1 ? "servizio" : "servizi"}`;
}
