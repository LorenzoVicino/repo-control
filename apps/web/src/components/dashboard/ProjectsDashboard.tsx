import { keyframes } from "@emotion/react";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  AppBar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import {
  fetchAppUpdateStatus,
  fetchDockerContainers,
  fetchPreferences,
  fetchProjects,
  pickWorkspaceFolder,
  setRootPath,
  stopDockerContainers,
  updatePreferences,
  updateRepoControl
} from "../../api/client";
import { APP_VERSION } from "../../config";
import { AppUpdateDialog } from "./AppUpdateDialog";
import { ControlCenter } from "./ControlCenter";
import { ProjectTable } from "./ProjectTable";
import { RepositoryCommandPalette } from "./RepositoryCommandPalette";
import { FavoriteProjects, WorkspaceMap } from "./WorkspaceMap";
import { WorkspaceToolbarPicker } from "./WorkspaceToolbarPicker";
import { ProjectOverlay } from "../project/ProjectOverlay";
import type { AppUpdateResult, AppUpdateStatus, ColorMode, DockerContainerGroup, ViewMode } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";
import { filterProjects, isProject } from "../../utils/projects";

const LEGACY_FAVORITE_PROJECTS_STORAGE_KEY = "repo-control-favorite-projects";
const APP_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DOCKER_POLL_INTERVAL_MS = 30 * 1000;
const updateAvailablePulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.36);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(37, 99, 235, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(37, 99, 235, 0);
  }
`;

type ProjectsDashboardProps = {
  colorMode: ColorMode;
  onToggleColorMode: () => void;
};

export function ProjectsDashboard({ colorMode, onToggleColorMode }: ProjectsDashboardProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("map");
  const [search, setSearch] = React.useState("");
  const [rootError, setRootError] = React.useState<string | null>(null);
  const [isPickingRoot, setIsPickingRoot] = React.useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = React.useState(false);
  const [appUpdateResult, setAppUpdateResult] = React.useState<AppUpdateResult | null>(null);
  const [isAppUpdateDialogOpen, setIsAppUpdateDialogOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [favoriteProjectIds, setFavoriteProjectIds] = React.useState<string[]>([]);
  const [openProjectIds, setOpenProjectIds] = React.useState<string[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [isProjectOverlayOpen, setIsProjectOverlayOpen] = React.useState(false);
  const [stoppingDockerGroupId, setStoppingDockerGroupId] = React.useState<string | null>(null);
  const [dockerActionError, setDockerActionError] = React.useState<string | null>(null);

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects
  });
  const {
    data: dockerStatus,
    isFetching: isFetchingDocker,
    isLoading: isLoadingDocker,
    refetch: refetchDockerContainers
  } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: fetchDockerContainers,
    refetchInterval: DOCKER_POLL_INTERVAL_MS
  });
  const { data: preferences } = useQuery({
    queryKey: ["preferences"],
    queryFn: fetchPreferences
  });
  const {
    data: appUpdateStatus,
    error: appUpdateStatusError,
    isFetching: isCheckingAppUpdate,
    isLoading: isLoadingAppUpdateStatus,
    refetch: refetchAppUpdateStatus
  } = useQuery({
    queryKey: ["app-update-status"],
    queryFn: fetchAppUpdateStatus,
    refetchInterval: APP_UPDATE_POLL_INTERVAL_MS
  });

  const projects = data?.projects ?? [];
  const filteredProjects = React.useMemo(() => filterProjects(projects, search), [projects, search]);
  const openProjects = React.useMemo(
    () => openProjectIds.map((projectId) => projects.find((project) => project.id === projectId)).filter(isProject),
    [openProjectIds, projects]
  );
  const workspaceRoot = data?.root ?? "";
  const canUpdateApp = Boolean(appUpdateStatus?.updateAvailable) && !isUpdatingApp;
  const appUpdateTooltip = getAppUpdateTooltip(
    appUpdateStatus,
    isLoadingAppUpdateStatus || (isCheckingAppUpdate && !appUpdateStatus),
    appUpdateStatusError,
    isUpdatingApp
  );

  React.useEffect(() => {
    if (!preferences) {
      return;
    }

    const legacyFavoriteProjectIds = getLegacyFavoriteProjectIds();
    const shouldMigrateLegacyPreferences =
      preferences.favoriteProjectIds.length === 0 && legacyFavoriteProjectIds.length > 0;
    const nextFavoriteProjectIds = shouldMigrateLegacyPreferences
      ? legacyFavoriteProjectIds
      : preferences.favoriteProjectIds;

    setFavoriteProjectIds(nextFavoriteProjectIds);

    if (shouldMigrateLegacyPreferences) {
      void updatePreferences({ favoriteProjectIds: nextFavoriteProjectIds }).then(() => {
        window.localStorage.removeItem(LEGACY_FAVORITE_PROJECTS_STORAGE_KEY);
      });
      return;
    }

    window.localStorage.removeItem(LEGACY_FAVORITE_PROJECTS_STORAGE_KEY);
  }, [preferences]);

  React.useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void handleFolderPick();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [workspaceRoot, isPickingRoot]);

  function handleViewChange(_: React.MouseEvent<HTMLElement>, nextMode: ViewMode | null) {
    if (nextMode) {
      setViewMode(nextMode);
    }
  }

  function openProject(projectId: string) {
    setOpenProjectIds((currentProjectIds) =>
      currentProjectIds.includes(projectId) ? currentProjectIds : [...currentProjectIds, projectId]
    );
    setActiveProjectId(projectId);
    setIsProjectOverlayOpen(true);
  }

  function toggleFavoriteProject(projectId: string) {
    setFavoriteProjectIds((currentProjectIds) => {
      const nextProjectIds = currentProjectIds.includes(projectId)
        ? currentProjectIds.filter((currentProjectId) => currentProjectId !== projectId)
        : [...currentProjectIds, projectId];

      void saveFavoriteProjectIds(nextProjectIds, currentProjectIds);
      return nextProjectIds;
    });
  }

  async function saveFavoriteProjectIds(nextProjectIds: string[], rollbackProjectIds: string[]) {
    try {
      await updatePreferences({ favoriteProjectIds: nextProjectIds });
    } catch {
      setFavoriteProjectIds(rollbackProjectIds);
    }
  }

  function closeProject(projectId: string) {
    const nextProjectIds = openProjectIds.filter((openProjectId) => openProjectId !== projectId);
    setOpenProjectIds(nextProjectIds);

    if (activeProjectId === projectId) {
      setActiveProjectId(nextProjectIds[nextProjectIds.length - 1] ?? null);
    }

    if (nextProjectIds.length === 0) {
      setIsProjectOverlayOpen(false);
    }
  }

  async function handleFolderPick() {
    if (isPickingRoot) {
      return;
    }

    setIsPickingRoot(true);
    setRootError(null);

    try {
      const pickedPath = await pickWorkspaceFolder(workspaceRoot);

      if (pickedPath && pickedPath !== workspaceRoot) {
        await applyRootPath(pickedPath);
      }
    } catch (error) {
      setRootError(error instanceof Error ? error.message : "Unable to pick folder");
    } finally {
      setIsPickingRoot(false);
    }
  }

  async function applyRootPath(root: string) {
    await setRootPath(root);
    setOpenProjectIds([]);
    setActiveProjectId(null);
    setIsProjectOverlayOpen(false);
    setSearch("");
    await refetch();
  }

  async function handleAppUpdate() {
    setIsUpdatingApp(true);
    setIsAppUpdateDialogOpen(true);
    setAppUpdateResult(null);

    try {
      const result = await updateRepoControl();
      setAppUpdateResult(result);

      if (!result.restartScheduled) {
        void refetchAppUpdateStatus();
      }
    } catch (error) {
      setAppUpdateResult({
        ...commandErrorResult("update repo-control", error),
        restartScheduled: false
      });
      void refetchAppUpdateStatus();
    } finally {
      setIsUpdatingApp(false);
    }
  }

  async function handleStopDockerGroup(group: DockerContainerGroup) {
    setStoppingDockerGroupId(group.id);
    setDockerActionError(null);

    try {
      await stopDockerContainers(group.containers.map((container) => container.id));
      await refetchDockerContainers();
    } catch (error) {
      setDockerActionError(error instanceof Error ? error.message : "Unable to stop Docker containers");
    } finally {
      setStoppingDockerGroupId(null);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ top: 0, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: "auto", md: 58 },
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              md: "minmax(150px, 210px) minmax(0, 1fr) auto"
            },
            gridTemplateAreas: {
              xs: '"brand actions" "command command"',
              md: '"brand command actions"'
            },
            alignItems: "center",
            gap: { xs: 1, md: 1.5 },
            px: { xs: 1.25, sm: 2 },
            py: { xs: 1, md: 0 },
            bgcolor: colorMode === "dark" ? "#181818" : "#f3f3f3"
          }}
        >
          <Stack
            component="h1"
            direction="row"
            alignItems="center"
            justifyContent="flex-start"
            sx={{
              gridArea: "brand",
              justifySelf: "start",
              minWidth: 0,
              m: 0,
              pl: { xs: 0.75, sm: 1 },
              overflow: "hidden"
            }}
          >
            <Box
              component="span"
              sx={{
                display: "block",
                flexShrink: 0,
                fontFamily: "monospace",
                fontSize: { xs: 19, sm: 22, md: 24 },
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: 0,
                whiteSpace: "nowrap",
                background: "linear-gradient(90deg, #28b8ff 0%, #1297ff 42%, #28e6cf 68%, #38f0a6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 16px rgba(40, 184, 255, 0.22)"
              }}
            >
              repo-control
            </Box>
          </Stack>

          <Box
            sx={{
              gridArea: "command",
              justifySelf: { xs: "stretch", md: "center" },
              width: { xs: "100%", md: "min(100%, 860px)" },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(190px, 260px) minmax(380px, 1fr)" },
              alignItems: "center",
              gap: 0.75
            }}
          >
            <WorkspaceToolbarPicker
              root={workspaceRoot}
              error={rootError}
              isPicking={isPickingRoot}
              onPick={handleFolderPick}
            />

            <TextField
              fullWidth
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onFocus={() => setIsCommandPaletteOpen(true)}
              onClick={() => setIsCommandPaletteOpen(true)}
              placeholder="Cerca repository (Ctrl+P)"
              variant="outlined"
              inputProps={{ "aria-label": "Apri command palette repository" }}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 36,
                  borderRadius: 1,
                  bgcolor: colorMode === "dark" ? "#2b2b2b" : "#ffffff",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  "& fieldset": {
                    borderColor: colorMode === "dark" ? "#3c3c3c" : "#d0d0d0"
                  },
                  "&:hover fieldset": {
                    borderColor: "primary.main"
                  },
                  "&.Mui-focused fieldset": {
                    borderWidth: 1
                  }
                },
                "& .MuiInputBase-input": {
                  cursor: "pointer"
                }
              }}
            />
          </Box>

          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ gridArea: "actions", justifySelf: "end", minWidth: 0 }}
          >
            <Chip
              size="small"
              variant="outlined"
              color={appUpdateStatus?.updateAvailable ? "primary" : "default"}
              label={`v${APP_VERSION}`}
              sx={{ display: { xs: "none", sm: "flex" } }}
            />
            <Tooltip title={appUpdateTooltip}>
              <span>
                <Badge
                  color="warning"
                  variant="dot"
                  invisible={!canUpdateApp}
                  overlap="rectangular"
                  sx={{
                    "& .MuiBadge-badge": {
                      boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`
                    }
                  }}
                >
                  <Button
                    size="small"
                    variant={canUpdateApp ? "contained" : "outlined"}
                    color={canUpdateApp ? "primary" : "inherit"}
                    aria-label={getAppUpdateAriaLabel(appUpdateStatus, canUpdateApp)}
                    startIcon={
                      isUpdatingApp || (isCheckingAppUpdate && !appUpdateStatus) ? (
                        <CircularProgress color="inherit" size={16} />
                      ) : (
                        <SyncIcon fontSize="small" />
                      )
                    }
                    onClick={handleAppUpdate}
                    disabled={!canUpdateApp}
                    sx={{
                      minWidth: { xs: 36, sm: 104 },
                      px: { xs: 1, sm: 1.5 },
                      fontWeight: canUpdateApp ? 800 : 500,
                      animation: canUpdateApp ? `${updateAvailablePulse} 1.8s ease-in-out infinite` : "none",
                      boxShadow: canUpdateApp ? "0 0 18px rgba(37, 99, 235, 0.32)" : undefined,
                      "&:hover": {
                        boxShadow: canUpdateApp ? "0 0 22px rgba(37, 99, 235, 0.42)" : undefined
                      },
                      "& .MuiButton-startIcon": {
                        ml: 0,
                        mr: { xs: 0, sm: 0.75 }
                      }
                    }}
                  >
                    <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                      Aggiorna
                    </Box>
                  </Button>
                </Badge>
              </span>
            </Tooltip>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              size="small"
              onChange={handleViewChange}
              aria-label="View mode"
            >
              <ToggleButton value="map" aria-label="Workspace map">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label="Table view">
                <TableRowsIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Refresh projects">
              <span>
                <IconButton onClick={() => refetch()} disabled={isFetching} aria-label="Refresh projects" size="small">
                  {isFetching ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              <IconButton onClick={onToggleColorMode} aria-label="Toggle color mode" size="small">
                {colorMode === "light" ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          <ControlCenter
            dockerStatus={dockerStatus}
            isLoadingDocker={isLoadingDocker}
            isRefreshingDocker={isFetchingDocker}
            onRefreshDocker={() => {
              void refetchDockerContainers();
            }}
            stoppingDockerGroupId={stoppingDockerGroupId}
            dockerActionError={dockerActionError}
            onStopDockerGroup={(group) => {
              void handleStopDockerGroup(group);
            }}
          />

          <FavoriteProjects
            projects={projects}
            favoriteProjectIds={favoriteProjectIds}
            onSelectProject={openProject}
            onToggleFavorite={toggleFavoriteProject}
          />

          {isLoading ? (
            <Box
              sx={{
                display: "grid",
                placeItems: "center",
                minHeight: 320,
                borderTop: "1px solid",
                borderBottom: "1px solid",
                borderColor: "divider"
              }}
            >
              <CircularProgress />
            </Box>
          ) : viewMode === "map" ? (
            <WorkspaceMap
              root={data?.root ?? ""}
              projects={filteredProjects}
              favoriteProjectIds={favoriteProjectIds}
              onSelectProject={openProject}
              onToggleFavorite={toggleFavoriteProject}
            />
          ) : (
            <Box
              sx={{
                overflow: "hidden",
                borderTop: "1px solid",
                borderBottom: "1px solid",
                borderColor: "divider"
              }}
            >
              <ProjectTable projects={filteredProjects} onSelectProject={openProject} />
            </Box>
          )}

          <ProjectOverlay
            open={isProjectOverlayOpen && openProjects.length > 0}
            projects={openProjects}
            activeProjectId={activeProjectId}
            favoriteProjectIds={favoriteProjectIds}
            onActiveProjectChange={setActiveProjectId}
            onCloseProject={closeProject}
            onCloseOverlay={() => setIsProjectOverlayOpen(false)}
            onToggleFavorite={toggleFavoriteProject}
            onRefresh={() => refetch()}
          />

          <RepositoryCommandPalette
            open={isCommandPaletteOpen}
            projects={projects}
            query={search}
            onQueryChange={setSearch}
            onClose={() => setIsCommandPaletteOpen(false)}
            onOpenProject={openProject}
          />
        </Stack>
      </Container>

      <AppUpdateDialog
        open={isAppUpdateDialogOpen}
        isUpdating={isUpdatingApp}
        result={appUpdateResult}
        onClose={() => setIsAppUpdateDialogOpen(false)}
      />
    </Box>
  );
}

function getAppUpdateTooltip(
  status: AppUpdateStatus | undefined,
  isLoading: boolean,
  error: unknown,
  isUpdating: boolean
): string {
  if (isUpdating) {
    return "Aggiornamento in corso";
  }

  if (isLoading) {
    return "Controllo nuove release in corso";
  }

  if (status?.updateAvailable && status.latestVersion) {
    return `Nuova release disponibile: v${status.latestVersion}`;
  }

  if (status?.error) {
    return `Controllo release non disponibile: ${status.error}`;
  }

  if (error instanceof Error) {
    return `Controllo release non riuscito: ${error.message}`;
  }

  return "Nessuna nuova release disponibile";
}

function getAppUpdateAriaLabel(status: AppUpdateStatus | undefined, canUpdate: boolean): string {
  if (canUpdate && status?.latestVersion) {
    return `Aggiorna repo-control alla versione ${status.latestVersion}`;
  }

  return "Aggiorna repo-control";
}

function getLegacyFavoriteProjectIds(): string[] {
  const storedProjectIds = window.localStorage.getItem(LEGACY_FAVORITE_PROJECTS_STORAGE_KEY);

  if (!storedProjectIds) {
    return [];
  }

  try {
    const parsedProjectIds = JSON.parse(storedProjectIds);
    return Array.isArray(parsedProjectIds)
      ? parsedProjectIds.filter((projectId): projectId is string => typeof projectId === "string")
      : [];
  } catch {
    return [];
  }
}
