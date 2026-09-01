import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LaunchOutlinedIcon from "@mui/icons-material/LaunchOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
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
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type {
  ContainerSessionKind,
  DockerContainer,
  DockerContainerGroup,
  DockerContainerStats,
  DockerContainersResponse
} from "../../types/docker";
import { findContainerStats, formatBytes, formatPercent } from "../docker/containerStats";

const MAX_VISIBLE_GROUPS = 5;

type ControlCenterProps = {
  dockerStatus: DockerContainersResponse | undefined;
  containerStats: DockerContainerStats[] | undefined;
  isLoadingDocker: boolean;
  isRefreshingDocker: boolean;
  stoppingDockerGroupId: string | null;
  dockerActionError: string | null;
  onRefreshDocker: () => void;
  onStopDockerGroup: (group: DockerContainerGroup) => void;
  onOpenContainerConsole: (container: DockerContainer, kind: ContainerSessionKind) => void;
};

export function ControlCenter({
  dockerStatus,
  containerStats,
  isLoadingDocker,
  isRefreshingDocker,
  stoppingDockerGroupId,
  dockerActionError,
  onRefreshDocker,
  onStopDockerGroup,
  onOpenContainerConsole
}: ControlCenterProps) {
  const { t } = useTranslation();
  const [showAllGroups, setShowAllGroups] = React.useState(false);
  const [pendingStopGroup, setPendingStopGroup] = React.useState<DockerContainerGroup | null>(null);
  const dockerGroups = dockerStatus?.groups ?? [];
  const visibleDockerGroups = showAllGroups ? dockerGroups : dockerGroups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenDockerGroupCount = dockerGroups.length - visibleDockerGroups.length;
  const dockerStateLabel = getDockerStateLabel(t, dockerStatus, isLoadingDocker);
  const dockerStateColor = dockerStatus?.ok ? "success" : dockerStatus ? "warning" : "default";
  const containers = dockerStatus?.containers ?? [];
  const attentionCount = containers.filter((container) => getContainerState(t, container).tone !== "success").length;
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
                {t("dashboard.runtime.title")}
              </Typography>
              <Chip size="small" label={dockerStateLabel} color={dockerStateColor} variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div">
              {t("dashboard.runtime.subtitle")}
            </Typography>
          </Box>
        </Stack>

        <Tooltip title={t("dashboard.runtime.refresh")}>
          <span>
            <IconButton
              size="small"
              aria-label={t("dashboard.runtime.refresh")}
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
          aria-label={t("dashboard.runtime.summaryAria")}
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
          <RuntimeMetric label={t("dashboard.runtime.groups")} value={dockerGroups.length} />
          <RuntimeMetric label={t("dashboard.runtime.services")} value={containers.length} />
          <RuntimeMetric
            label={t("dashboard.runtime.needsAttention")}
            value={attentionCount}
            tone={attentionCount > 0 ? "warning.main" : "success.main"}
          />
          <RuntimeMetric label={t("dashboard.runtime.publishedPorts")} value={publishedPortCount} />
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
                  containerStats={containerStats}
                  isStopping={stoppingDockerGroupId === group.id}
                  onRequestStop={() => setPendingStopGroup(group)}
                  onOpenContainerConsole={onOpenContainerConsole}
                />
              ))}
            </Stack>
            {hiddenDockerGroupCount > 0 ? (
              <Button variant="outlined" onClick={() => setShowAllGroups(true)} sx={{ alignSelf: "flex-start" }}>
                {t("dashboard.runtime.showMoreGroups", { count: hiddenDockerGroupCount })}
              </Button>
            ) : showAllGroups && dockerGroups.length > MAX_VISIBLE_GROUPS ? (
              <Button variant="text" onClick={() => setShowAllGroups(false)} sx={{ alignSelf: "flex-start" }}>
                {t("dashboard.runtime.showFewerGroups")}
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
              {isLoadingDocker
                ? t("dashboard.runtime.readingContainers")
                : t("dashboard.runtime.noContainers")}
            </Typography>
          </Stack>
        )}
      </Box>

      <Dialog open={Boolean(pendingStopGroup)} onClose={() => setPendingStopGroup(null)} maxWidth="xs" fullWidth>
        {pendingStopGroup ? (
          <>
            <DialogTitle>{t("dashboard.runtime.confirmStopTitle")}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary">
                {t("dashboard.runtime.confirmStopBody", {
                  services: formatServiceCount(t, pendingStopGroup.containers.length),
                  group: pendingStopGroup.name
                })}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingStopGroup(null)}>{t("common.cancel")}</Button>
              <Button
                color="warning"
                variant="contained"
                onClick={() => {
                  onStopDockerGroup(pendingStopGroup);
                  setPendingStopGroup(null);
                }}
              >
                {t("dashboard.runtime.stopServices", {
                  services: formatServiceCount(t, pendingStopGroup.containers.length)
                })}
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
  containerStats: DockerContainerStats[] | undefined;
  isStopping: boolean;
  onRequestStop: () => void;
  onOpenContainerConsole: (container: DockerContainer, kind: ContainerSessionKind) => void;
};

function DockerProjectGroup({
  group,
  defaultExpanded,
  containerStats,
  isStopping,
  onRequestStop,
  onOpenContainerConsole
}: DockerProjectGroupProps) {
  const { t } = useTranslation();
  const attentionCount = group.containers.filter((container) => getContainerState(t, container).tone !== "success").length;
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
              {group.workingDir
                ?? (group.composeProject
                  ? `Compose · ${group.composeProject}`
                  : t("dashboard.runtime.standaloneContainer"))}
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" color={groupHealthy ? "success" : "warning"} label={formatServiceCount(t, group.containers.length)} />
        </Stack>
      </AccordionSummary>
      <Tooltip title={t("dashboard.runtime.stopOnly", { group: group.name })}>
        <span style={{ position: "absolute", right: 44, top: "50%", transform: "translateY(-50%)" }}>
          <IconButton
            size="small"
            color="warning"
            aria-label={group.composeProject
              ? t("dashboard.runtime.stopCompose", { group: group.name })
              : t("dashboard.runtime.stopContainer", { group: group.name })}
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
          {group.containers.map((container) => (
            <DockerServiceRow
              key={container.id}
              container={container}
              stats={findContainerStats(containerStats, container.id)}
              onOpenContainerConsole={onOpenContainerConsole}
            />
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

function DockerServiceRow({
  container,
  stats,
  onOpenContainerConsole
}: {
  container: DockerContainer;
  stats: DockerContainerStats | null;
  onOpenContainerConsole: (container: DockerContainer, kind: ContainerSessionKind) => void;
}) {
  const { t } = useTranslation();
  const state = getContainerState(t, container);
  const ports = getPublishedPorts(container.ports);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(160px, 0.9fr) minmax(150px, 0.8fr) minmax(190px, 1.1fr) minmax(112px, 0.5fr) auto" }, gap: { xs: 1, md: 1.5 }, px: 1.5, py: 1.25, alignItems: "center" }}>
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
        )) : (
          <Typography variant="caption" color="text.secondary">
            {t("dashboard.runtime.noPublishedPorts")}
          </Typography>
        )}
      </Stack>
      <Box
        sx={{ minWidth: 0 }}
        aria-label={
          stats
            ? t("docker.stats.ariaLabel", {
                cpu: formatPercent(stats.cpuPercent),
                memory: formatBytes(stats.memoryUsedBytes)
              })
            : t("docker.stats.unavailable")
        }
      >
        <Typography noWrap sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5 }}>
          {t("docker.stats.cpu")} {formatPercent(stats?.cpuPercent ?? null)}
        </Typography>
        <Typography color="text.disabled" noWrap sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>
          {formatBytes(stats?.memoryUsedBytes ?? null)} / {formatBytes(stats?.memoryLimitBytes ?? null)}
        </Typography>
      </Box>
      <Stack direction="row" spacing={0.25} alignItems="center" sx={{ justifySelf: { md: "end" } }}>
        <Tooltip title={t("docker.console.openShell", { container: container.name })}>
          <IconButton
            size="small"
            aria-label={t("docker.console.openShell", { container: container.name })}
            onClick={() => onOpenContainerConsole(container, "exec")}
          >
            <TerminalOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("docker.console.openLogs", { container: container.name })}>
          <IconButton
            size="small"
            aria-label={t("docker.console.openLogs", { container: container.name })}
            onClick={() => onOpenContainerConsole(container, "logs")}
          >
            <ArticleOutlinedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

function getContainerState(
  t: TFunction,
  container: DockerContainer
): { label: string; tone: "success" | "warning" | "error" | "default" } {
  const normalized = container.status.toLowerCase();
  if (normalized.includes("unhealthy") || normalized.includes("dead") || normalized.includes("exited")) {
    return {
      label: normalized.includes("unhealthy")
        ? t("dashboard.runtime.state.unhealthy")
        : t("dashboard.runtime.state.stopped"),
      tone: "error"
    };
  }
  if (normalized.includes("restarting") || normalized.includes("starting")) {
    return { label: t("dashboard.runtime.state.starting"), tone: "warning" };
  }
  if (normalized.includes("healthy")) return { label: t("dashboard.runtime.state.healthy"), tone: "success" };
  if (normalized.startsWith("up")) return { label: t("dashboard.runtime.state.running"), tone: "success" };
  return { label: container.status || t("dashboard.runtime.state.unknown"), tone: "default" };
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
  t: TFunction,
  dockerStatus: DockerContainersResponse | undefined,
  isLoadingDocker: boolean
): string {
  if (isLoadingDocker && !dockerStatus) return t("dashboard.runtime.reading");
  if (!dockerStatus) return t("shared.notAvailable");
  if (!dockerStatus.ok) return t("dashboard.runtime.unavailable");
  return t("dashboard.runtime.projectCount", { count: dockerStatus.groups.length });
}

function formatServiceCount(t: TFunction, count: number): string {
  return t("dashboard.runtime.serviceCount", { count });
}
