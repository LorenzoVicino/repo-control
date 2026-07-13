import { keyframes } from "@emotion/react";
import MenuIcon from "@mui/icons-material/Menu";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  alpha,
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
  Tooltip,
  Typography
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
import { DashboardMetrics } from "./DashboardMetrics";
import {
  DashboardSidebar,
  type DashboardSection
} from "./DashboardSidebar";
import { ProjectTable } from "./ProjectTable";
import { RepositoryCommandPalette } from "./RepositoryCommandPalette";
import { FavoriteProjects, WorkspaceMap } from "./WorkspaceMap";
import { ProjectOverlay } from "../project/ProjectOverlay";
import { TaskEngineeringPage } from "../task/TaskEngineeringPage";
import type { AppUpdateResult, AppUpdateStatus, ColorMode, DockerContainerGroup, ViewMode } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";
import { filterProjects, getStats, isProject } from "../../utils/projects";

const LEGACY_FAVORITE_PROJECTS_STORAGE_KEY = "repo-control-favorite-projects";
const APP_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DOCKER_POLL_INTERVAL_MS = 30 * 1000;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "repo-control-sidebar-collapsed";
const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  overview: "Panoramica",
  tasks: "Task engineering",
  docker: "Docker runtime",
  favorites: "Preferiti",
  repositories: "Repository"
};
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

const sectionReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

type ProjectsDashboardProps = {
  colorMode: ColorMode;
  onToggleColorMode: () => void;
};

export function ProjectsDashboard({ colorMode, onToggleColorMode }: ProjectsDashboardProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("map");
  const [activeSection, setActiveSection] = React.useState<DashboardSection>("overview");
  const [workspaceView, setWorkspaceView] = React.useState<"dashboard" | "tasks">("dashboard");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
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
  const stats = React.useMemo(() => getStats(projects), [projects]);
  const favoriteProjectCount = React.useMemo(
    () => projects.filter((project) => favoriteProjectIds.includes(project.id)).length,
    [favoriteProjectIds, projects]
  );
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
    if (workspaceView !== "dashboard") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    const sectionIds: DashboardSection[] = ["overview", "docker", "favorites", "repositories"];
    const sectionElements = sectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((element): element is HTMLElement => element !== null);

    if (sectionElements.length === 0) {
      return;
    }

    let animationFrame: number | null = null;

    function updateActiveSection() {
      const activationOffset = 120;
      let nextActiveSection = sectionElements[0].id as DashboardSection;

      for (const sectionElement of sectionElements) {
        if (sectionElement.getBoundingClientRect().top <= activationOffset) {
          nextActiveSection = sectionElement.id as DashboardSection;
        }
      }

      setActiveSection(nextActiveSection);
      animationFrame = null;
    }

    function scheduleActiveSectionUpdate() {
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(updateActiveSection);
      }
    }

    updateActiveSection();
    window.addEventListener("scroll", scheduleActiveSectionUpdate, { passive: true });

    return () => {
      window.removeEventListener("scroll", scheduleActiveSectionUpdate);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [favoriteProjectCount, workspaceView]);

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

  function navigateToSection(section: DashboardSection) {
    setActiveSection(section);
    setIsMobileSidebarOpen(false);

    if (section === "tasks") {
      setWorkspaceView("tasks");
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    setWorkspaceView("dashboard");

    window.requestAnimationFrame(() => {
      const sectionElement = document.getElementById(section);
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sectionElement?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    });
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
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", bgcolor: "background.default" }}>
      <DashboardSidebar
        activeSection={activeSection}
        collapsed={isSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        colorMode={colorMode}
        repositoryCount={projects.length}
        favoriteCount={favoriteProjectCount}
        dockerCount={dockerStatus?.groups.length ?? 0}
        workspaceRoot={workspaceRoot}
        rootError={rootError}
        isPickingRoot={isPickingRoot}
        onNavigate={navigateToSection}
        onToggleCollapsed={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onPickWorkspace={() => {
          void handleFolderPick();
        }}
        onToggleColorMode={onToggleColorMode}
      />

      <Box sx={{ minWidth: 0, flexGrow: 1, minHeight: "100vh" }}>
      <AppBar
        component="header"
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
          borderBottom: "1px solid",
          borderColor: "divider",
          backdropFilter: "blur(14px)"
        }}
      >
        <Toolbar
          sx={{
            width: "100%",
            maxWidth: 1680,
            mx: "auto",
            minHeight: { xs: "auto", md: 68 },
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              md: "minmax(170px, 0.55fr) minmax(320px, 1.45fr) auto"
            },
            gridTemplateAreas: {
              xs: '"context actions" "search search"',
              md: '"context search actions"'
            },
            alignItems: "center",
            gap: { xs: 1, md: 2 },
            px: { xs: 1.5, sm: 2.5, lg: 3 },
            py: { xs: 1.25, md: 0 }
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{
              gridArea: "context",
              justifySelf: "start",
              minWidth: 0,
              overflow: "hidden"
            }}
          >
            <IconButton
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Apri navigazione"
              sx={{ display: { xs: "inline-flex", md: "none" }, flexShrink: 0 }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                <Box component="span" sx={{ display: { xs: "inline", md: "none" }, fontWeight: 750 }}>
                  repo-control ·{" "}
                </Box>
                Workspace
              </Typography>
              <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                {DASHBOARD_SECTION_LABELS[activeSection]}
              </Typography>
            </Box>
          </Stack>

          <Box
            sx={{
              gridArea: "search",
              justifySelf: { xs: "stretch", md: "center" },
              width: { xs: "100%", md: "min(100%, 760px)" }
            }}
          >
            <Tooltip title="Cerca repository (Ctrl+P)" placement="bottom">
              <TextField
                fullWidth
                size="small"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onFocus={() => setIsCommandPaletteOpen(true)}
                onClick={() => setIsCommandPaletteOpen(true)}
                placeholder="Cerca repository"
                variant="outlined"
                inputProps={{ "aria-label": "Apri ricerca repository, scorciatoia Ctrl+P" }}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        component="kbd"
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          px: 0.7,
                          py: 0.2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 0.5,
                          bgcolor: "action.hover",
                          fontFamily: "inherit",
                          fontSize: "0.65rem"
                        }}
                      >
                        Ctrl+P
                      </Typography>
                    </InputAdornment>
                  )
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 38,
                    borderRadius: 0.875,
                    cursor: "pointer",
                    fontSize: "0.875rem",
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
            </Tooltip>
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
              aria-label="Modalità vista"
            >
              <ToggleButton value="map" aria-label="Griglia repository">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label="Vista tabella">
                <TableRowsIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Aggiorna repository">
              <span>
                <IconButton onClick={() => refetch()} disabled={isFetching} aria-label="Aggiorna repository" size="small">
                  {isFetching ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container
        component="main"
        maxWidth={false}
        sx={{ maxWidth: 1680, px: { xs: 1.5, sm: 2.5, lg: 3 }, py: { xs: 2, md: 3 } }}
      >
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          {workspaceView === "tasks" ? (
            <TaskEngineeringPage projects={projects} />
          ) : (
            <>
          <Box
            id="overview"
            component="section"
            aria-labelledby="workspace-overview-title"
            sx={{
              scrollMarginTop: 92,
              animation: `${sectionReveal} 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" }
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "flex-end" }}
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Box>
                <Typography id="workspace-overview-title" component="h1" variant="h1">
                  Panoramica workspace
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  Stato operativo dei repository locali e dei servizi collegati.
                </Typography>
              </Box>
              <Chip
                variant="outlined"
                color={isFetching ? "primary" : "default"}
                label={isFetching ? "Sincronizzazione" : `${projects.length} repository`}
              />
            </Stack>
            <DashboardMetrics stats={stats} />
          </Box>

          <Box
            id="docker"
            sx={{
              scrollMarginTop: 92,
              animation: `${sectionReveal} 320ms 60ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" }
            }}
          >
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
          </Box>

          {favoriteProjectIds.length > 0 ? (
            <Box
              id="favorites"
              sx={{
                scrollMarginTop: 92,
                animation: `${sectionReveal} 320ms 120ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
                "@media (prefers-reduced-motion: reduce)": { animation: "none" }
              }}
            >
              <FavoriteProjects
                projects={projects}
                favoriteProjectIds={favoriteProjectIds}
                onSelectProject={openProject}
                onToggleFavorite={toggleFavoriteProject}
              />
            </Box>
          ) : null}

          <Box
            id="repositories"
            component="section"
            aria-labelledby="repository-list-title"
            sx={{
              scrollMarginTop: 92,
              animation: `${sectionReveal} 320ms 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" }
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5 }}
            >
              <Box>
                <Typography id="repository-list-title" component="h2" variant="h2">
                  Repository
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {search ? `${filteredProjects.length} risultati per “${search}”` : "Organizzati per cartella di lavoro"}
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={filteredProjects.length} />
            </Stack>

            {isLoading ? (
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  minHeight: 320,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper"
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
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper"
                }}
              >
                <ProjectTable projects={filteredProjects} onSelectProject={openProject} />
              </Box>
            )}
          </Box>

            </>
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
