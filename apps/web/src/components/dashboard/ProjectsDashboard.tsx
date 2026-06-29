import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchProjects, pickWorkspaceFolder, setRootPath, updateRepoControl } from "../../api/client";
import { APP_VERSION } from "../../config";
import { AppUpdateDialog } from "./AppUpdateDialog";
import { DashboardMetrics } from "./DashboardMetrics";
import { ProjectTable } from "./ProjectTable";
import { WorkspacePickerBar } from "./WorkspacePickerBar";
import { WorkspaceMap } from "./WorkspaceMap";
import { ProjectOverlay } from "../project/ProjectOverlay";
import type { AppUpdateResult, ColorMode, ViewMode } from "../../types";
import { commandErrorResult } from "../../utils/commandResult";
import { filterProjects, getStats, isProject } from "../../utils/projects";

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
  const [openProjectIds, setOpenProjectIds] = React.useState<string[]>([]);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [isProjectOverlayOpen, setIsProjectOverlayOpen] = React.useState(false);

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects
  });

  const projects = data?.projects ?? [];
  const filteredProjects = React.useMemo(() => filterProjects(projects, search), [projects, search]);
  const openProjects = React.useMemo(
    () => openProjectIds.map((projectId) => projects.find((project) => project.id === projectId)).filter(isProject),
    [openProjectIds, projects]
  );
  const stats = React.useMemo(() => getStats(projects), [projects]);
  const workspaceRoot = data?.root ?? "";

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
    } catch (error) {
      setAppUpdateResult({
        ...commandErrorResult("update repo-control", error),
        restartScheduled: false
      });
    } finally {
      setIsUpdatingApp(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: "1px solid", borderColor: "divider", gap: 1.5 }}>
          <Stack component="h1" direction="row" alignItems="center" sx={{ flexGrow: 1, minWidth: 0, m: 0 }}>
            <Box
              component="img"
              src="/repo-control.png"
              alt="repo-control"
              sx={{
                display: "block",
                height: { xs: 30, sm: 38 },
                width: "auto",
                maxWidth: { xs: 146, sm: 220 },
                objectFit: "contain",
                flexShrink: 0
              }}
            />
          </Stack>
          <Chip size="small" variant="outlined" label={`v${APP_VERSION}`} />
          <Button
            size="small"
            variant="outlined"
            startIcon={isUpdatingApp ? <CircularProgress color="inherit" size={16} /> : <SyncIcon fontSize="small" />}
            onClick={handleAppUpdate}
            disabled={isUpdatingApp}
            sx={{ minWidth: 104 }}
          >
            Aggiorna
          </Button>
          <ToggleButtonGroup value={viewMode} exclusive size="small" onChange={handleViewChange} aria-label="View mode">
            <ToggleButton value="map" aria-label="Workspace map">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="table" aria-label="Table view">
              <TableRowsIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Refresh projects">
            <span>
              <IconButton onClick={() => refetch()} disabled={isFetching} aria-label="Refresh projects">
                {isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={colorMode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
            <IconButton onClick={onToggleColorMode} aria-label="Toggle color mode">
              {colorMode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          <WorkspacePickerBar
            root={workspaceRoot}
            error={rootError}
            isPicking={isPickingRoot}
            onPick={handleFolderPick}
          />

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ md: "center" }}
            justifyContent="center"
          >
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca repo, branch o path"
              sx={{ width: { xs: "100%", md: 520 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Chip label={`${filteredProjects.length}/${projects.length} repositories`} variant="outlined" />
          </Stack>

          <DashboardMetrics stats={stats} />

          {isLoading ? (
            <Paper variant="outlined" sx={{ display: "grid", placeItems: "center", minHeight: 320 }}>
              <CircularProgress />
            </Paper>
          ) : viewMode === "map" ? (
            <WorkspaceMap root={data?.root ?? ""} projects={filteredProjects} onSelectProject={openProject} />
          ) : (
            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <ProjectTable projects={filteredProjects} onSelectProject={openProject} />
            </Paper>
          )}

          <ProjectOverlay
            open={isProjectOverlayOpen && openProjects.length > 0}
            projects={openProjects}
            activeProjectId={activeProjectId}
            onActiveProjectChange={setActiveProjectId}
            onCloseProject={closeProject}
            onCloseOverlay={() => setIsProjectOverlayOpen(false)}
            onRefresh={() => refetch()}
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
