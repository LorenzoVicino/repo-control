import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { Box, ButtonBase, Chip, CircularProgress, IconButton, Link, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchDockerServiceLogs } from "../../api/docker";
import type { CommandResult } from "../../types/common";
import type { DockerComposeProjectResponse, DockerComposeService } from "../../types/docker";
import { formatDate } from "../../utils/projects";
import { ActionButton } from "../shared/ActionButton";
import { EmptyPanel } from "../shared/EmptyPanel";
import { LoadingPanel } from "../shared/LoadingPanel";

type DockerDetailPanelProps = {
  projectId: string;
  compose: DockerComposeProjectResponse | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function DockerDetailPanel({ projectId, compose, isLoading, onResult, onCompleted }: DockerDetailPanelProps) {
  const { t } = useTranslation();
  const [selectedService, setSelectedService] = React.useState<string | null>(null);
  const runningServices = compose?.services.filter((service) => service.state.toLowerCase() === "running").length ?? 0;
  const selected = compose?.services.some((service) => service.name === selectedService)
    ? selectedService
    : compose?.services[0]?.name ?? null;
  const logsQuery = useQuery({
    queryKey: ["docker-service-logs", projectId, selected],
    queryFn: () => fetchDockerServiceLogs(projectId, selected!),
    enabled: Boolean(selected && compose?.ok)
  });

  if (isLoading && !compose) return <LoadingPanel label={t("project.docker.loading")} />;
  if (!compose) return <EmptyPanel label={t("project.docker.unavailable")} />;
  if (!compose.ok) return <EmptyPanel label={compose.error ?? t("project.docker.unavailable")} />;

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Inventory2OutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1">{compose.name}</Typography>
            <Chip size="small" label={t("project.docker.running", { running: runningServices, total: compose.services.length })} color={runningServices > 0 ? "success" : "default"} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {t("project.docker.updatedAt", { date: formatDate(compose.checkedAt) })}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {runningServices === 0 ? (
            <ActionButton projectId={projectId} actionPath="docker/up" label={t("project.docker.startStack")} icon={<PlayArrowIcon />} variant="contained" onResult={onResult} onCompleted={onCompleted} />
          ) : (
            <ActionButton projectId={projectId} actionPath="docker/stop" label={t("project.docker.stopStack")} icon={<StopCircleOutlinedIcon />} onResult={onResult} onCompleted={onCompleted} />
          )}
          <ActionButton projectId={projectId} actionPath="docker/rebuild" label={t("project.docker.rebuild")} icon={<BuildOutlinedIcon />} onResult={onResult} onCompleted={onCompleted} />
        </Stack>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(360px, 0.8fr)" }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 720 }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "minmax(150px, 1.2fr) 110px minmax(140px, 1fr) minmax(160px, 1fr) 48px",
                  gap: 1,
                  px: 1.4,
                  py: 0.9,
                  bgcolor: "action.hover",
                  borderBottom: "1px solid",
                  borderColor: "divider"
                }}
              >
                {([
                  t("project.docker.columnService"),
                  t("project.docker.columnState"),
                  t("project.docker.columnImage"),
                  t("project.docker.columnPorts"),
                  ""
                ]).map((label, index) => (
                  <Typography key={`${label}-${index}`} variant="overline" color="text.secondary">{label}</Typography>
                ))}
              </Box>
              {compose.services.map((service) => (
                <DockerServiceRow
                  key={service.name}
                  service={service}
                  selected={service.name === selected}
                  onSelect={() => setSelectedService(service.name)}
                  restartAction={
                    <ActionButton
                      projectId={projectId}
                      actionPath="docker/restart-service"
                      label={t("project.docker.restart")}
                      icon={<RestartAltIcon fontSize="small" />}
                      body={{ service: service.name }}
                      disabled={service.state.toLowerCase() !== "running"}
                      onResult={onResult}
                      onCompleted={onCompleted}
                    />
                  }
                />
              ))}
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ minHeight: 320, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" sx={{ px: 1.3, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap>
                {t("project.docker.logsTitle", { service: selected ?? t("project.docker.logsFallbackService") })}
              </Typography>
              <Typography variant="caption" color="text.secondary">{t("project.docker.lastLines")}</Typography>
            </Box>
            <Tooltip title={t("project.docker.refreshLogs")}>
              <span>
                <IconButton size="small" aria-label={t("project.docker.refreshLogs")} onClick={() => void logsQuery.refetch()} disabled={!selected || logsQuery.isFetching}>
                  {logsQuery.isFetching ? <CircularProgress size={15} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.4,
              minHeight: 0,
              maxHeight: 480,
              overflow: "auto",
              bgcolor: "#050b14",
              color: logsQuery.error ? "#fecaca" : "#cbd5e1",
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 12,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}
          >
            {logsQuery.error instanceof Error
              ? logsQuery.error.message
              : logsQuery.data?.output
                || (logsQuery.isFetching ? t("project.docker.loadingLogs") : t("project.docker.noLogs"))}
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}

function DockerServiceRow({
  service,
  selected,
  onSelect,
  restartAction
}: {
  service: DockerComposeService;
  selected: boolean;
  onSelect: () => void;
  restartAction: React.ReactNode;
}) {
  const { t } = useTranslation();
  const running = service.state.toLowerCase() === "running";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "minmax(150px, 1.2fr) 110px minmax(140px, 1fr) minmax(160px, 1fr) 48px",
        gap: 1,
        alignItems: "center",
        px: 1.4,
        py: 1.05,
        bgcolor: selected ? "action.selected" : "transparent",
        borderBottom: "1px solid",
        borderColor: "divider"
      }}
    >
      <ButtonBase
        onClick={onSelect}
        aria-pressed={selected}
        sx={{ minWidth: 0, display: "block", textAlign: "left", borderRadius: 0.75, p: 0.35, ml: -0.35 }}
      >
        <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{service.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">{service.containerName ?? t("project.docker.containerNotCreated")}</Typography>
      </ButtonBase>
      <Box>
        <Chip size="small" label={service.health ?? service.state} color={service.health === "unhealthy" ? "error" : running ? "success" : "default"} />
      </Box>
      <Typography variant="caption" noWrap title={service.image ?? undefined}>{service.image ?? "—"}</Typography>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
        {service.ports.length > 0 ? service.ports.map((port) => {
          const label = port.published ? `${port.published}:${port.target}` : String(port.target);
          return port.url ? (
            <Link key={`${port.target}-${port.published}-${port.protocol}`} href={port.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} variant="caption">
              {label}
            </Link>
          ) : <Chip key={`${port.target}-${port.protocol}`} size="small" label={label} variant="outlined" />;
        }) : <Typography variant="caption" color="text.secondary">—</Typography>}
      </Stack>
      <Box
        onClick={(event) => event.stopPropagation()}
        sx={{
          "& .MuiButton-root": {
            minWidth: 36,
            width: 36,
            px: 0,
            fontSize: 0,
            "& .MuiButton-startIcon": { m: 0 },
            "& .MuiButton-endIcon": { m: 0 }
          }
        }}
      >
        {restartAction}
      </Box>
    </Box>
  );
}
