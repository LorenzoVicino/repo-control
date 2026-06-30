import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { Box, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { DockerContainerGroup, DockerContainersResponse } from "../../types";

const MAX_VISIBLE_GROUPS = 5;
const MAX_VISIBLE_SERVICES = 4;

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
  const dockerGroups = dockerStatus?.groups ?? [];
  const visibleDockerGroups = dockerGroups.slice(0, MAX_VISIBLE_GROUPS);
  const hiddenDockerGroupCount = dockerGroups.length - visibleDockerGroups.length;
  const dockerStateLabel = getDockerStateLabel(dockerStatus, isLoadingDocker);
  const dockerStateColor = dockerStatus?.ok ? "success" : dockerStatus ? "warning" : "default";

  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderBottom: "1px solid",
        borderColor: "divider",
        py: { xs: 1.25, md: 1.5 },
        minWidth: 0
      }}
    >
      <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <StorageIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary" component="div">
                Docker
              </Typography>
              <Chip size="small" label={dockerStateLabel} color={dockerStateColor} variant="outlined" />
            </Stack>

            <Tooltip title="Aggiorna container Docker">
              <span>
                <IconButton
                  size="small"
                  aria-label="Aggiorna container Docker"
                  onClick={onRefreshDocker}
                  disabled={isRefreshingDocker}
                >
                  {isRefreshingDocker ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>

          {dockerStatus?.error ? (
            <Typography color="text.secondary" variant="body2" noWrap>
              {dockerStatus.error}
            </Typography>
          ) : visibleDockerGroups.length > 0 ? (
            <Stack spacing={0.75}>
              {dockerActionError ? (
                <Typography color="error" variant="caption" noWrap>
                  {dockerActionError}
                </Typography>
              ) : null}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    xl: "repeat(3, minmax(0, 1fr))"
                  },
                  gap: 0.75
                }}
              >
                {visibleDockerGroups.map((group) => (
                  <DockerProjectGroup
                    key={group.id}
                    group={group}
                    isStopping={stoppingDockerGroupId === group.id}
                    onStop={() => onStopDockerGroup(group)}
                  />
                ))}
                {hiddenDockerGroupCount > 0 ? (
                <Box
                  sx={{
                    minHeight: 44,
                    display: "grid",
                    placeItems: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary"
                  }}
                >
                  <Typography variant="body2">+{hiddenDockerGroupCount}</Typography>
                </Box>
                ) : null}
              </Box>
            </Stack>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 44, color: "text.secondary" }}>
              {isLoadingDocker ? <CircularProgress size={18} /> : <PlayCircleOutlineIcon fontSize="small" />}
              <Typography variant="body2">
                {isLoadingDocker ? "Lettura container Docker" : "Nessun container avviato"}
              </Typography>
            </Stack>
          )}
      </Box>
    </Box>
  );
}

type DockerProjectGroupProps = {
  group: DockerContainerGroup;
  isStopping: boolean;
  onStop: () => void;
};

function DockerProjectGroup({ group, isStopping, onStop }: DockerProjectGroupProps) {
  const visibleServices = group.containers.slice(0, MAX_VISIBLE_SERVICES);
  const hiddenServiceCount = group.containers.length - visibleServices.length;

  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1,
        py: 0.75,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "action.hover"
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "success.main",
            flexShrink: 0
          }}
        />
        <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
          {group.name}
        </Typography>
        <Chip size="small" label={group.containers.length} variant="outlined" />
        <Tooltip title={group.composeProject ? "Ferma compose" : "Ferma container"}>
          <span>
            <IconButton
              size="small"
              color="warning"
              aria-label={group.composeProject ? `Ferma compose ${group.name}` : `Ferma container ${group.name}`}
              onClick={onStop}
              disabled={isStopping}
              sx={{ mr: -0.5 }}
            >
              {isStopping ? <CircularProgress color="inherit" size={16} /> : <StopCircleIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
        {visibleServices.map((container) => (
          <Chip
            key={container.id}
            size="small"
            label={container.composeService ?? container.name}
            variant="outlined"
            sx={{ maxWidth: 130 }}
          />
        ))}
        {hiddenServiceCount > 0 ? <Chip size="small" label={`+${hiddenServiceCount}`} variant="outlined" /> : null}
      </Stack>
      {group.workingDir ? (
        <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.5 }}>
          {group.workingDir}
        </Typography>
      ) : null}
    </Box>
  );
}

function getDockerStateLabel(
  dockerStatus: DockerContainersResponse | undefined,
  isLoadingDocker: boolean
): string {
  if (isLoadingDocker && !dockerStatus) {
    return "lettura";
  }

  if (!dockerStatus) {
    return "n/d";
  }

  if (!dockerStatus.ok) {
    return "non disponibile";
  }

  return `${dockerStatus.groups.length} progetti`;
}
