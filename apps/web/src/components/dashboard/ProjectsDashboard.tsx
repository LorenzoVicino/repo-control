import { keyframes } from "@emotion/react";
import {
  Box,
  Chip,
  CircularProgress,
  Container,
  Stack,
  Typography
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchAppUpdateStatus, updateRepoControl } from "../../api/app";
import { fetchDockerContainers, stopDockerContainers } from "../../api/docker";
import { fetchProjects } from "../../api/projects";
import {
  fetchPreferences,
  pickWorkspaceFolder,
  setRootPath,
  updatePreferences
} from "../../api/workspace";
import { AppUpdateDialog } from "./AppUpdateDialog";
import { ControlCenter } from "./ControlCenter";
import { DashboardAppBar } from "./DashboardAppBar";
import { DashboardHome } from "./DashboardHome";
import {
  DashboardSidebar,
  type DashboardSection
} from "./DashboardSidebar";
import { ProjectTable } from "./ProjectTable";
import { RepositoryCommandPalette } from "./RepositoryCommandPalette";
import { FavoriteProjects, WorkspaceMap } from "./WorkspaceMap";
import { ProjectDetailPanel } from "../project/ProjectDetailPanel";
import { ProjectWorkspaceTabs } from "../project/ProjectWorkspaceTabs";
import { getProjectPanelId } from "../project/projectWorkspaceIds";
import { TaskEngineeringPage } from "../task/TaskEngineeringPage";
import type { AppUpdateResult } from "../../types/app";
import type { ColorMode, ViewMode } from "../../types/common";
import type { DockerContainerGroup } from "../../types/docker";
import { commandErrorResult } from "../../utils/commandResult";
import { filterProjects, isProject } from "../../utils/projects";

const LEGACY_FAVORITE_PROJECTS_STORAGE_KEY = "repo-control-favorite-projects";
const APP_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DOCKER_POLL_INTERVAL_MS = 30 * 1000;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "repo-control-sidebar-collapsed";
const AutomationPage = React.lazy(async () => {
  const module = await import("../automation/AutomationPage");
  return { default: module.AutomationPage };
});
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

  const projects = React.useMemo(() => data?.projects ?? [], [data?.projects]);
  const filteredProjects = React.useMemo(() => filterProjects(projects, search), [projects, search]);
  const favoriteProjectCount = React.useMemo(
    () => projects.filter((project) => favoriteProjectIds.includes(project.id)).length,
    [favoriteProjectIds, projects]
  );
  const openProjects = React.useMemo(
    () => openProjectIds.map((projectId) => projects.find((project) => project.id === projectId)).filter(isProject),
    [openProjectIds, projects]
  );
  const activeProject = React.useMemo(
    () => openProjects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, openProjects]
  );
  const workspaceRoot = data?.root ?? "";

  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    const availableProjectIds = new Set(projects.map((project) => project.id));
    const validOpenProjectIds = openProjectIds.filter((projectId) => availableProjectIds.has(projectId));

    if (validOpenProjectIds.length !== openProjectIds.length) {
      setOpenProjectIds(validOpenProjectIds);
    }

    if (activeProjectId && !availableProjectIds.has(activeProjectId)) {
      setActiveProjectId(null);
    }
  }, [activeProjectId, openProjectIds, projects]);

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

  const applyRootPath = React.useCallback(async (root: string) => {
    await setRootPath(root);
    setOpenProjectIds([]);
    setActiveProjectId(null);
    setSearch("");
    await refetch();
  }, [refetch]);

  const handleFolderPick = React.useCallback(async () => {
    if (isPickingRoot) return;

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
  }, [applyRootPath, isPickingRoot, workspaceRoot]);

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
  }, [handleFolderPick]);

  function navigateToSection(section: DashboardSection) {
    setActiveSection(section);
    setActiveProjectId(null);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openProject(projectId: string) {
    setOpenProjectIds((currentProjectIds) =>
      currentProjectIds.includes(projectId) ? currentProjectIds : [...currentProjectIds, projectId]
    );
    setActiveSection("repositories");
    setActiveProjectId(projectId);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function activateProject(projectId: string) {
    setActiveSection("repositories");
    setActiveProjectId(projectId);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
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
    const closingProjectIndex = openProjectIds.indexOf(projectId);
    const nextProjectIds = openProjectIds.filter((openProjectId) => openProjectId !== projectId);
    setOpenProjectIds(nextProjectIds);

    if (activeProjectId === projectId) {
      const nextActiveProjectId = openProjectIds[closingProjectIndex + 1]
        ?? openProjectIds[closingProjectIndex - 1]
        ?? null;
      setActiveProjectId(nextActiveProjectId);
    }
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
      <DashboardAppBar
        activeSection={activeSection}
        activeProjectName={activeProject?.name ?? null}
        search={search}
        viewMode={viewMode}
        appUpdateStatus={appUpdateStatus}
        appUpdateStatusError={appUpdateStatusError}
        isCheckingAppUpdate={isCheckingAppUpdate}
        isLoadingAppUpdateStatus={isLoadingAppUpdateStatus}
        isUpdatingApp={isUpdatingApp}
        isFetchingProjects={isFetching}
        onOpenMobileNavigation={() => setIsMobileSidebarOpen(true)}
        onOpenSearch={() => setIsCommandPaletteOpen(true)}
        onUpdateApp={() => void handleAppUpdate()}
        onViewModeChange={setViewMode}
        onRefreshProjects={() => void refetch()}
      />

      <ProjectWorkspaceTabs
        projects={openProjects}
        activeProjectId={activeProjectId}
        onActiveProjectChange={activateProject}
        onCloseProject={closeProject}
      />

      <Container
        component="main"
        maxWidth={false}
        sx={{
          maxWidth: 1680,
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          py: activeProject ? { xs: 1.5, md: 2 } : { xs: 2, md: 3 }
        }}
      >
        <Stack spacing={{ xs: 2.5, md: 3 }}>
          {activeProject ? (
            <ViewEntrance>
              <Box
                sx={{
                  minWidth: 0,
                  minHeight: { xs: 720, lg: 620 },
                  height: { xs: "auto", lg: "calc(100dvh - 153px)" }
                }}
              >
                {openProjects.map((project) => (
                  <Box
                    key={project.id}
                    id={getProjectPanelId(project.id)}
                    role="tabpanel"
                    aria-label={`Repository ${project.name}`}
                    hidden={project.id !== activeProject.id}
                    sx={{ minHeight: "100%", height: "100%" }}
                  >
                    <ProjectDetailPanel
                      project={project}
                      isFavorite={favoriteProjectIds.includes(project.id)}
                      onToggleFavorite={() => toggleFavoriteProject(project.id)}
                      onResult={() => undefined}
                      onRefresh={() => void refetch()}
                    />
                  </Box>
                ))}
              </Box>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "overview" ? (
            <ViewEntrance>
              <Box component="section" aria-labelledby="dashboard-home-title">
                <DashboardHome onNavigate={navigateToSection} />
              </Box>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "tasks" ? (
            <ViewEntrance>
              <TaskEngineeringPage projects={projects} />
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "automations" ? (
            <ViewEntrance>
              <React.Suspense
                fallback={
                  <Box sx={{ minHeight: 420, display: "grid", placeItems: "center" }}>
                    <CircularProgress aria-label="Caricamento automazioni" />
                  </Box>
                }
              >
                <AutomationPage projects={projects} />
              </React.Suspense>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "docker" ? (
            <ViewEntrance>
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
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "favorites" ? (
            <ViewEntrance>
              {favoriteProjectCount > 0 ? (
                <FavoriteProjects
                  projects={projects}
                  favoriteProjectIds={favoriteProjectIds}
                  onSelectProject={openProject}
                  onToggleFavorite={toggleFavoriteProject}
                />
              ) : (
                <Box component="section" aria-labelledby="favorites-title">
                  <Typography id="favorites-title" component="h1" variant="h1">Preferiti</Typography>
                  <Box
                    sx={{
                      minHeight: 220,
                      mt: 1.5,
                      display: "grid",
                      placeItems: "center",
                      border: "1px dashed",
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "background.paper"
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">Nessun repository preferito.</Typography>
                  </Box>
                </Box>
              )}
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "repositories" ? (
            <ViewEntrance>
              <Box component="section" aria-labelledby="repository-list-title">
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1.5 }}
                >
                  <Box>
                    <Typography id="repository-list-title" component="h1" variant="h1">Repository</Typography>
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
            </ViewEntrance>
          ) : null}

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

function ViewEntrance({ children }: React.PropsWithChildren) {
  return (
    <Box
      sx={{
        animation: `${sectionReveal} 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" }
      }}
    >
      {children}
    </Box>
  );
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
