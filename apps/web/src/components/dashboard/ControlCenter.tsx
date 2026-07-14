import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { alpha, Box, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import type { DockerContainerGroup, DockerContainersResponse } from "../../types/docker";

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
    <Box component="section" aria-labelledby="docker-runtime-title" sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between">
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
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Typography id="docker-runtime-title" component="h1" variant="h1">
                Docker runtime
              </Typography>
              <Chip size="small" label={dockerStateLabel} color={dockerStateColor} variant="outlined" />
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              Container attivi nel workspace locale
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

      <Box sx={{ mt: 1.5 }}>
        {dockerStatus?.error ? (
          <Box
            sx={{
              px: 1.5,
              py: 1.25,
              border: "1px solid",
              borderColor: "warning.main",
              borderRadius: 1,
              bgcolor: (theme) => alpha(theme.palette.warning.main, 0.07)
            }}
          >
            <Typography color="text.secondary" variant="body2">
              {dockerStatus.error}
            </Typography>
          </Box>
        ) : visibleDockerGroups.length > 0 ? (
          <Stack spacing={1}>
            {dockerActionError ? (
              <Typography color="error" variant="caption">
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
                gap: 1
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
                    minHeight: 82,
                    display: "grid",
                    placeItems: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 1,
                    color: "text.secondary",
                    bgcolor: "background.paper"
                  }}
                >
                  <Typography variant="body2">Altri {hiddenDockerGroupCount} progetti</Typography>
                </Box>
              ) : null}
            </Box>
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
        px: 1.25,
        py: 1,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: (theme) => alpha(theme.palette.success.main, 0.45),
          boxShadow: (theme) =>
            `0 7px 20px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.045 : 0.16)}`
        }
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
            boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.success.main, 0.12)}`,
            flexShrink: 0
          }}
        />
        <Typography variant="body2" fontWeight={750} noWrap sx={{ minWidth: 0, flexGrow: 1 }}>
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
              {isStopping ? <CircularProgress color="inherit" size={15} /> : <StopCircleIcon fontSize="small" />}
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
        <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.6 }}>
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
