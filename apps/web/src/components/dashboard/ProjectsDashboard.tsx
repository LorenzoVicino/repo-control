import { keyframes } from "@emotion/react";
import {
  Box,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchAppUpdateStatus, updateRepoControl } from "../../api/app";
import { fetchDockerContainers, stopDockerContainers } from "../../api/docker";
import { fetchProjects, fetchProjectSummary } from "../../api/projects";
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
  DashboardHomeSkeleton,
  RepositoryGridSkeleton,
  RepositoryTableSkeleton
} from "./DashboardScanSkeleton";
import {
  DashboardSidebar,
  type DashboardSection
} from "./DashboardSidebar";
import { ProjectTable } from "./ProjectTable";
import { RepositoryCommandPalette } from "./RepositoryCommandPalette";
import { FavoriteProjects, WorkspaceMap } from "./WorkspaceMap";
import { ProjectWorkspaceTabs } from "../project/ProjectWorkspaceTabs";
import { getProjectPanelId } from "../project/projectWorkspaceIds";
import { SettingsPage } from "../settings/SettingsPage";
import type { AppUpdateResult } from "../../types/app";
import type { ColorPalette, ViewMode } from "../../types/common";
import type { DockerContainerGroup } from "../../types/docker";
import type { ProjectsResponse } from "../../types/projects";
import { commandErrorResult } from "../../utils/commandResult";
import { filterProjects, isProject } from "../../utils/projects";

const LEGACY_FAVORITE_PROJECTS_STORAGE_KEY = "repo-control-favorite-projects";
const APP_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DOCKER_POLL_INTERVAL_MS = 60 * 1000;
const MAX_WARM_PROJECT_PANELS = 4;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "repo-control-sidebar-collapsed";
type RepositorySort = "attention" | "name" | "recent" | "changes";
type RepositoryGrouping = "folder" | "status";
type RepositoryDensity = "compact" | "comfortable";
const loadAppMotionBackdrop = () => import("./AppMotionBackdrop");
const loadAgentSessionsPage = () => import("../agents/AgentSessionsPage");
const loadAutomationPage = () => import("../automation/AutomationPage");
const loadProjectDetailPanel = () => import("../project/ProjectDetailPanel");
const loadTaskEngineeringPage = () => import("../task/TaskEngineeringPage");
const AppMotionBackdrop = React.lazy(async () => {
  const module = await loadAppMotionBackdrop();
  return { default: module.AppMotionBackdrop };
});
const AgentSessionsPage = React.lazy(async () => {
  const module = await loadAgentSessionsPage();
  return { default: module.AgentSessionsPage };
});
const AutomationPage = React.lazy(async () => {
  const module = await loadAutomationPage();
  return { default: module.AutomationPage };
});
const ProjectDetailPanel = React.lazy(async () => {
  const module = await loadProjectDetailPanel();
  return { default: module.ProjectDetailPanel };
});
const TaskEngineeringPage = React.lazy(async () => {
  const module = await loadTaskEngineeringPage();
  return { default: module.TaskEngineeringPage };
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
  colorPalette: ColorPalette;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
};

function ignoreCommandResult(): void {}

export function ProjectsDashboard({
  colorPalette,
  onColorPaletteChange
}: ProjectsDashboardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isNavigating, startNavigationTransition] = React.useTransition();
  const [viewMode, setViewMode] = React.useState<ViewMode>("map");
  const [repositorySort, setRepositorySort] = React.useState<RepositorySort>("attention");
  const [repositoryGrouping, setRepositoryGrouping] = React.useState<RepositoryGrouping>("folder");
  const [repositoryDensity, setRepositoryDensity] = React.useState<RepositoryDensity>("comfortable");
  const [activeSection, setActiveSection] = React.useState<DashboardSection>("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(
    () => window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true"
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [rootError, setRootError] = React.useState<string | null>(null);
  const [isPickingRoot, setIsPickingRoot] = React.useState(false);
  const [isScanningRoot, setIsScanningRoot] = React.useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = React.useState(false);
  const [appUpdateResult, setAppUpdateResult] = React.useState<AppUpdateResult | null>(null);
  const [isAppUpdateDialogOpen, setIsAppUpdateDialogOpen] = React.useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);
  const [favoriteProjectIds, setFavoriteProjectIds] = React.useState<string[]>([]);
  const [openProjectIds, setOpenProjectIds] = React.useState<string[]>([]);
  const [warmProjectIds, setWarmProjectIds] = React.useState<string[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [stoppingDockerGroupId, setStoppingDockerGroupId] = React.useState<string | null>(null);
  const [dockerActionError, setDockerActionError] = React.useState<string | null>(null);

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => fetchProjects(signal)
  });
  const {
    data: dockerStatus,
    isFetching: isFetchingDocker,
    isLoading: isLoadingDocker,
    refetch: refetchDockerContainers
  } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: fetchDockerContainers,
    staleTime: DOCKER_POLL_INTERVAL_MS - 5 * 1000,
    refetchInterval: DOCKER_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true
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
    staleTime: APP_UPDATE_POLL_INTERVAL_MS,
    refetchInterval: APP_UPDATE_POLL_INTERVAL_MS,
    refetchIntervalInBackground: false
  });

  const projects = React.useMemo(() => data?.projects ?? [], [data?.projects]);
  const filteredProjects = React.useMemo(() => filterProjects(projects, search), [projects, search]);
  const repositoryProjects = React.useMemo(
    () => sortRepositoryProjects(filteredProjects, repositorySort),
    [filteredProjects, repositorySort]
  );
  const favoriteProjectIdSet = React.useMemo(() => new Set(favoriteProjectIds), [favoriteProjectIds]);
  const projectsById = React.useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const favoriteProjectCount = React.useMemo(
    () => projects.filter((project) => favoriteProjectIdSet.has(project.id)).length,
    [favoriteProjectIdSet, projects]
  );
  const openProjects = React.useMemo(
    () => openProjectIds.map((projectId) => projectsById.get(projectId)).filter(isProject),
    [openProjectIds, projectsById]
  );
  const warmProjectIdSet = React.useMemo(() => new Set(warmProjectIds), [warmProjectIds]);
  const activeProject = React.useMemo(
    () => openProjects.find((project) => project.id === activeProjectId) ?? null,
    [activeProjectId, openProjects]
  );
  const workspaceRoot = data?.root ?? "";
  const dockerAvailable = dockerStatus?.ok === true;

  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    if (!dockerAvailable && activeSection === "docker") {
      setActiveSection("overview");
    }
  }, [activeSection, dockerAvailable]);

  React.useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const idleCallbackId = window.requestIdleCallback(() => {
        void loadProjectDetailPanel();
      }, { timeout: 3000 });

      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const preloadTimer = window.setTimeout(() => {
      void loadProjectDetailPanel();
    }, 1000);
    return () => window.clearTimeout(preloadTimer);
  }, []);

  React.useEffect(() => {
    const availableProjectIds = new Set(projects.map((project) => project.id));
    const validOpenProjectIds = openProjectIds.filter((projectId) => availableProjectIds.has(projectId));

    if (validOpenProjectIds.length !== openProjectIds.length) {
      setOpenProjectIds(validOpenProjectIds);
    }

    setWarmProjectIds((currentProjectIds) => {
      const validProjectIds = currentProjectIds.filter((projectId) => availableProjectIds.has(projectId));
      return haveSameProjectIds(validProjectIds, currentProjectIds) ? currentProjectIds : validProjectIds;
    });

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
    await queryClient.cancelQueries({ queryKey: ["projects"] });
    const { root: nextRoot } = await setRootPath(root);
    queryClient.setQueryData<ProjectsResponse>(["projects"], {
      root: nextRoot,
      projects: []
    });
    setOpenProjectIds([]);
    setWarmProjectIds([]);
    setActiveProjectId(null);
    setSearch("");
    await refetch({ throwOnError: true });
  }, [queryClient, refetch]);

  const handleFolderPick = React.useCallback(async () => {
    if (isPickingRoot || isScanningRoot) return;

    setIsPickingRoot(true);
    setRootError(null);
    let pickedPath: string | null;

    try {
      pickedPath = await pickWorkspaceFolder(workspaceRoot);
    } catch (error) {
      setRootError(error instanceof Error ? error.message : t("errors.pickFolder"));
      return;
    } finally {
      setIsPickingRoot(false);
    }

    if (!pickedPath || pickedPath === workspaceRoot) return;

    setIsScanningRoot(true);

    try {
      await applyRootPath(pickedPath);
    } catch (error) {
      setRootError(error instanceof Error ? error.message : t("errors.scanWorkspace"));
    } finally {
      setIsScanningRoot(false);
    }
  }, [applyRootPath, isPickingRoot, isScanningRoot, t, workspaceRoot]);

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

  const navigateToSection = React.useCallback((section: DashboardSection) => {
    if (section === "docker" && !dockerAvailable) {
      return;
    }

    if (section === "tasks") void loadTaskEngineeringPage();
    if (section === "agents") void loadAgentSessionsPage();
    if (section === "automations") void loadAutomationPage();

    startNavigationTransition(() => {
      setActiveSection(section);
      setActiveProjectId(null);
      setIsMobileSidebarOpen(false);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [dockerAvailable]);

  const openProject = React.useCallback((projectId: string) => {
    void loadProjectDetailPanel();
    setIsCommandPaletteOpen(false);
    setOpenProjectIds((currentProjectIds) =>
      currentProjectIds.includes(projectId) ? currentProjectIds : [...currentProjectIds, projectId]
    );
    setWarmProjectIds((currentProjectIds) => getNextWarmProjectIds(currentProjectIds, projectId));
    setActiveSection("repositories");
    setActiveProjectId(projectId);
    setIsMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const activateProject = React.useCallback((projectId: string) => {
    startNavigationTransition(() => {
      setActiveSection("repositories");
      setActiveProjectId(projectId);
      setWarmProjectIds((currentProjectIds) => getNextWarmProjectIds(currentProjectIds, projectId));
      setIsMobileSidebarOpen(false);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const saveFavoriteProjectIds = React.useCallback(async (
    nextProjectIds: string[],
    rollbackProjectIds: string[]
  ) => {
    try {
      await updatePreferences({ favoriteProjectIds: nextProjectIds });
    } catch {
      setFavoriteProjectIds((currentProjectIds) =>
        haveSameProjectIds(currentProjectIds, nextProjectIds) ? rollbackProjectIds : currentProjectIds
      );
    }
  }, []);

  const toggleFavoriteProject = React.useCallback((projectId: string) => {
    setFavoriteProjectIds((currentProjectIds) => {
      const nextProjectIds = currentProjectIds.includes(projectId)
        ? currentProjectIds.filter((currentProjectId) => currentProjectId !== projectId)
        : [...currentProjectIds, projectId];

      void saveFavoriteProjectIds(nextProjectIds, currentProjectIds);
      return nextProjectIds;
    });
  }, [saveFavoriteProjectIds]);

  const refreshProjectSummary = React.useCallback(async (projectId: string) => {
    try {
      const refreshedProject = await fetchProjectSummary(projectId);
      queryClient.setQueryData<ProjectsResponse>(["projects"], (currentData) => {
        if (!currentData) {
          return currentData;
        }

        return {
          ...currentData,
          projects: currentData.projects.map((project) =>
            project.id === refreshedProject.id ? refreshedProject : project
          )
        };
      });
    } catch {
      // Git details remain authoritative; the next explicit workspace refresh will reconcile the summary.
    }
  }, [queryClient]);

  const closeProject = React.useCallback((projectId: string) => {
    const closingProjectIndex = openProjectIds.indexOf(projectId);
    const nextProjectIds = openProjectIds.filter((openProjectId) => openProjectId !== projectId);
    setOpenProjectIds(nextProjectIds);

    if (activeProjectId === projectId) {
      const nextActiveProjectId = openProjectIds[closingProjectIndex + 1]
        ?? openProjectIds[closingProjectIndex - 1]
        ?? null;
      setActiveProjectId(nextActiveProjectId);
      setWarmProjectIds((currentProjectIds) => {
        const remainingProjectIds = currentProjectIds.filter((currentProjectId) => currentProjectId !== projectId);
        return nextActiveProjectId
          ? getNextWarmProjectIds(remainingProjectIds, nextActiveProjectId)
          : remainingProjectIds;
      });
      return;
    }

    setWarmProjectIds((currentProjectIds) =>
      currentProjectIds.filter((currentProjectId) => currentProjectId !== projectId)
    );
  }, [activeProjectId, openProjectIds]);

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
      setDockerActionError(error instanceof Error ? error.message : t("errors.stopDocker"));
    } finally {
      setStoppingDockerGroupId(null);
    }
  }

  const isAutomationWorkspace = !activeProject && activeSection === "automations";

  return (
    <Box
      sx={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100vh",
        height: isAutomationWorkspace ? "100dvh" : undefined,
        display: "flex",
        alignItems: isAutomationWorkspace ? "stretch" : "flex-start",
        overflow: isAutomationWorkspace ? "hidden" : "visible",
        bgcolor: "background.default"
      }}
    >
      <React.Suspense fallback={null}>
        <AppMotionBackdrop />
      </React.Suspense>

      <DashboardSidebar
        activeSection={activeSection}
        collapsed={isSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        colorPalette={colorPalette}
        repositoryCount={projects.length}
        favoriteCount={favoriteProjectCount}
        dockerCount={dockerStatus?.groups.length ?? 0}
        dockerAvailable={dockerAvailable}
        workspaceRoot={workspaceRoot}
        rootError={rootError}
        isPickingRoot={isPickingRoot}
        isScanningRoot={isScanningRoot}
        openProjects={openProjects}
        activeProjectId={activeProjectId}
        onNavigate={navigateToSection}
        onOpenProject={activateProject}
        onToggleCollapsed={() => setIsSidebarCollapsed((currentValue) => !currentValue)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onPickWorkspace={() => {
          void handleFolderPick();
        }}
        onColorPaletteChange={onColorPaletteChange}
      />

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          minWidth: 0,
          flexGrow: 1,
          minHeight: "100vh",
          height: isAutomationWorkspace ? "100dvh" : undefined,
          display: isAutomationWorkspace ? "flex" : "block",
          flexDirection: isAutomationWorkspace ? "column" : undefined,
          overflow: isAutomationWorkspace ? "hidden" : "visible"
        }}
      >
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
        aria-busy={isNavigating}
        maxWidth={false}
        sx={{
          maxWidth: isAutomationWorkspace ? "none" : 1680,
          px: isAutomationWorkspace ? 0 : { xs: 1.5, sm: 2.5, lg: 3 },
          py: isAutomationWorkspace ? 0 : activeProject ? { xs: 1.5, md: 2 } : { xs: 2, md: 3 },
          flexGrow: isAutomationWorkspace ? 1 : undefined,
          minHeight: isAutomationWorkspace ? 0 : undefined,
          overflow: isAutomationWorkspace ? "hidden" : "visible"
        }}
      >
        <Stack
          spacing={{ xs: 2.5, md: 3 }}
          sx={{ height: isAutomationWorkspace ? "100%" : undefined, minHeight: 0 }}
        >
          {activeProject ? (
            <ViewEntrance>
              <Box
                sx={{
                  minWidth: 0,
                  minHeight: { xs: 720, lg: 620 },
                  height: { xs: "auto", lg: "calc(100dvh - 121px)" }
                }}
              >
                {openProjects.map((project) => (
                  <Box
                    key={project.id}
                    id={getProjectPanelId(project.id)}
                    role="tabpanel"
                    aria-label={t("repositories.projectAriaLabel", { name: project.name })}
                    hidden={project.id !== activeProject.id}
                    sx={{ minHeight: "100%", height: "100%" }}
                  >
                    {warmProjectIdSet.has(project.id) ? (
                      <React.Suspense fallback={<ProjectDetailLoading />}>
                        <ProjectDetailPanel
                          project={project}
                          isActive={project.id === activeProject.id}
                          isFavorite={favoriteProjectIdSet.has(project.id)}
                          onToggleFavorite={toggleFavoriteProject}
                          onResult={ignoreCommandResult}
                          onRefresh={refreshProjectSummary}
                        />
                      </React.Suspense>
                    ) : null}
                  </Box>
                ))}
              </Box>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "overview" ? (
            <ViewEntrance>
              <Box
                component="section"
                aria-labelledby={isScanningRoot ? undefined : "dashboard-home-title"}
              >
                {isScanningRoot ? (
                  <DashboardHomeSkeleton />
                ) : (
                  <DashboardHome
                    projects={projects}
                    favoriteProjectIds={favoriteProjectIds}
                    dockerStatus={dockerStatus}
                    onNavigate={navigateToSection}
                    onOpenProject={openProject}
                  />
                )}
              </Box>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "tasks" ? (
            <ViewEntrance>
              <React.Suspense fallback={<SectionLoading label={t("loading.tasks")} />}>
                <TaskEngineeringPage projects={projects} />
              </React.Suspense>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "agents" ? (
            <ViewEntrance>
              <React.Suspense fallback={<SectionLoading label={t("loading.agents")} />}>
                <AgentSessionsPage />
              </React.Suspense>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "automations" ? (
            <ViewEntrance fill>
              <React.Suspense
                fallback={<SectionLoading label={t("loading.automations")} fill />}
              >
                <AutomationPage projects={projects} />
              </React.Suspense>
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "docker" && dockerAvailable ? (
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
              {isScanningRoot ? (
                <RepositoryGridSkeleton />
              ) : (
                <FavoriteProjects
                  projects={projects}
                  favoriteProjectIds={favoriteProjectIds}
                  openProjectIds={openProjectIds}
                  density={repositoryDensity}
                  onSelectProject={openProject}
                  onToggleFavorite={toggleFavoriteProject}
                  onDensityChange={setRepositoryDensity}
                  onBrowseRepositories={() => navigateToSection("repositories")}
                />
              )}
            </ViewEntrance>
          ) : null}

          {!activeProject && activeSection === "settings" ? (
            <ViewEntrance>
              <SettingsPage />
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
                    <Typography id="repository-list-title" component="h1" variant="h1">
                      {t("repositories.title")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {search
                        ? t("repositories.searchResults", { count: filteredProjects.length, search })
                        : t("repositories.organizedByFolder")}
                    </Typography>
                  </Box>
                  <Chip size="small" variant="outlined" label={filteredProjects.length} />
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ sm: "center" }}
                  sx={{ mb: 1.5, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "var(--rc-surface-1)" }}
                >
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <Select
                      value={repositorySort}
                      onChange={(event) => setRepositorySort(event.target.value as RepositorySort)}
                      inputProps={{ "aria-label": t("repositories.sortAriaLabel") }}
                    >
                      <MenuItem value="attention">{t("repositories.sort.attention")}</MenuItem>
                      <MenuItem value="recent">{t("repositories.sort.recent")}</MenuItem>
                      <MenuItem value="changes">{t("repositories.sort.changes")}</MenuItem>
                      <MenuItem value="name">{t("repositories.sort.name")}</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }} disabled={viewMode !== "map"}>
                    <Select
                      value={repositoryGrouping}
                      onChange={(event) => setRepositoryGrouping(event.target.value as RepositoryGrouping)}
                      inputProps={{ "aria-label": t("repositories.groupAriaLabel") }}
                    >
                      <MenuItem value="folder">{t("repositories.group.folder")}</MenuItem>
                      <MenuItem value="status">{t("repositories.group.status")}</MenuItem>
                    </Select>
                  </FormControl>
                  <Box sx={{ flex: 1 }} />
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={repositoryDensity}
                    onChange={(_, value: RepositoryDensity | null) => {
                      if (value) setRepositoryDensity(value);
                    }}
                    aria-label={t("repositories.densityAriaLabel")}
                  >
                    <ToggleButton value="compact" aria-label={t("repositories.densityCompactAriaLabel")}>
                      {t("repositories.densityCompact")}
                    </ToggleButton>
                    <ToggleButton value="comfortable" aria-label={t("repositories.densityComfortableAriaLabel")}>
                      {t("repositories.densityComfortable")}
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Stack>

                {isLoading || isScanningRoot ? (
                  viewMode === "map" ? (
                    <RepositoryGridSkeleton />
                  ) : (
                    <RepositoryTableSkeleton />
                  )
                ) : viewMode === "map" ? (
                  <WorkspaceMap
                    root={data?.root ?? ""}
                    projects={repositoryProjects}
                    favoriteProjectIds={favoriteProjectIds}
                    openProjectIds={openProjectIds}
                    density={repositoryDensity}
                    groupBy={repositoryGrouping}
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
                    <ProjectTable
                      projects={repositoryProjects}
                      openProjectIds={openProjectIds}
                      density={repositoryDensity}
                      onSelectProject={openProject}
                    />
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

function ProjectDetailLoading() {
  const { t } = useTranslation();
  return <SectionLoading label={t("repositories.loading")} minHeight={620} />;
}

type SectionLoadingProps = {
  label: string;
  minHeight?: number;
  fill?: boolean;
};

function SectionLoading({ label, minHeight = 420, fill = false }: SectionLoadingProps) {
  return (
    <Box sx={{ minHeight: fill ? 0 : minHeight, height: fill ? "100%" : undefined, display: "grid", placeItems: "center" }}>
      <CircularProgress aria-label={label} />
    </Box>
  );
}

function ViewEntrance({ children, fill = false }: React.PropsWithChildren<{ fill?: boolean }>) {
  return (
    <Box
      sx={{
        height: fill ? "100%" : undefined,
        minHeight: 0,
        animation: `${sectionReveal} 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" }
      }}
    >
      {children}
    </Box>
  );
}

function haveSameProjectIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((projectId, index) => projectId === right[index]);
}

function getNextWarmProjectIds(currentProjectIds: string[], projectId: string): string[] {
  return [projectId, ...currentProjectIds.filter((currentProjectId) => currentProjectId !== projectId)]
    .slice(0, MAX_WARM_PROJECT_PANELS);
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

function sortRepositoryProjects(projects: ProjectsResponse["projects"], sort: RepositorySort) {
  return [...projects].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "recent") {
      const leftDate = left.lastCommit ? Date.parse(left.lastCommit.date) : 0;
      const rightDate = right.lastCommit ? Date.parse(right.lastCommit.date) : 0;
      return rightDate - leftDate || left.name.localeCompare(right.name);
    }
    if (sort === "changes") {
      const leftChanges = left.modified + left.staged + left.untracked;
      const rightChanges = right.modified + right.staged + right.untracked;
      return rightChanges - leftChanges || left.name.localeCompare(right.name);
    }

    const leftAttention = Number(!left.isClean) * 100 + left.behind * 10 + left.ahead;
    const rightAttention = Number(!right.isClean) * 100 + right.behind * 10 + right.ahead;
    return rightAttention - leftAttention || left.name.localeCompare(right.name);
  });
}
