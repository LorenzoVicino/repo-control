import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AddIcon from "@mui/icons-material/Add";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import LightModeIcon from "@mui/icons-material/LightMode";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import TableRowsIcon from "@mui/icons-material/TableRows";
import TerminalIcon from "@mui/icons-material/Terminal";
import UndoIcon from "@mui/icons-material/Undo";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  Dialog,
  DialogContent,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
  alpha,
  createTheme,
  useTheme
} from "@mui/material";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

type ProjectSummary = {
  id: string;
  name: string;
  path: string;
  branch: string;
  isClean: boolean;
  staged: number;
  modified: number;
  untracked: number;
  ahead: number;
  behind: number;
  upstream: string | null;
  lastCommit: {
    hash: string;
    message: string;
    date: string;
    author: string;
  } | null;
  hasDockerCompose: boolean;
};

type ProjectsResponse = {
  root: string;
  projects: ProjectSummary[];
};

type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

type GitChangeGroups = {
  staged: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
  untracked: string[];
  conflicted: string[];
};

type GitBranchInfo = {
  name: string;
  current: boolean;
  remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
};

type GitDetails = {
  status: {
    current: string;
    detached: boolean;
    isClean: boolean;
    tracking: string | null;
    ahead: number;
    behind: number;
    files: GitChangeGroups;
  };
  branches: {
    current: string;
    local: GitBranchInfo[];
    remote: GitBranchInfo[];
  };
};

type ViewMode = "map" | "table";
type ColorMode = "light" | "dark";
type ProjectDetailTab = "changes" | "branches" | "terminal";

type ProjectTone = {
  label: string;
  chipColor: "success" | "warning" | "secondary" | "info";
  borderColor: string;
  background: string;
};

const queryClient = new QueryClient();

const COLOR_MODE_STORAGE_KEY = "repo-control-color-mode";

function createAppTheme(colorMode: ColorMode) {
  return createTheme({
    palette: {
      mode: colorMode,
      primary: {
        main: colorMode === "light" ? "#2563eb" : "#7aa2ff"
      },
      background: {
        default: colorMode === "light" ? "#f6f8fa" : "#0f141b",
        paper: colorMode === "light" ? "#ffffff" : "#171c24"
      }
    },
    shape: {
      borderRadius: 6
    },
    typography: {
      h1: {
        fontSize: "1.2rem",
        fontWeight: 700
      },
      h2: {
        fontSize: "1rem",
        fontWeight: 700
      }
    }
  });
}

function App() {
  const [colorMode, setColorMode] = React.useState<ColorMode>(getInitialColorMode);
  const theme = React.useMemo(() => createAppTheme(colorMode), [colorMode]);

  React.useEffect(() => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
  }, [colorMode]);

  function toggleColorMode() {
    setColorMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <ProjectsDashboard colorMode={colorMode} onToggleColorMode={toggleColorMode} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function getInitialColorMode(): ColorMode {
  const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);

  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function ProjectsDashboard({
  colorMode,
  onToggleColorMode
}: {
  colorMode: ColorMode;
  onToggleColorMode: () => void;
}) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("map");
  const [search, setSearch] = React.useState("");
  const [rootDraft, setRootDraft] = React.useState("");
  const [rootError, setRootError] = React.useState<string | null>(null);
  const [isChangingRoot, setIsChangingRoot] = React.useState(false);
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

  React.useEffect(() => {
    if (data?.root) {
      setRootDraft(data.root);
    }
  }, [data?.root]);

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

  async function handleRootSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsChangingRoot(true);
    setRootError(null);

    try {
      const result = await setRootPath(rootDraft);
      setRootDraft(result.root);
      setOpenProjectIds([]);
      setActiveProjectId(null);
      setIsProjectOverlayOpen(false);
      setSearch("");
      await refetch();
    } catch (error) {
      setRootError(error instanceof Error ? error.message : "Unable to change folder");
    } finally {
      setIsChangingRoot(false);
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar sx={{ borderBottom: "1px solid", borderColor: "divider", gap: 1.5 }}>
          <Typography component="h1" variant="h1" sx={{ flexGrow: 1 }}>
            repo-control
          </Typography>
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
          <Paper variant="outlined" sx={{ p: 1.5 }}>
            <Box component="form" onSubmit={handleRootSubmit}>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ lg: "flex-start" }}>
                <TextField
                  size="small"
                  label="Workspace folder"
                  value={rootDraft}
                  onChange={(event) => setRootDraft(event.target.value)}
                  error={Boolean(rootError)}
                  helperText={rootError ?? "Usa un path assoluto o ~/projects"}
                  sx={{ flexGrow: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <FolderOpenIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={isChangingRoot ? <CircularProgress color="inherit" size={16} /> : <FolderOpenIcon />}
                  disabled={isChangingRoot || rootDraft.trim().length === 0}
                  sx={{ minWidth: 116 }}
                >
                  Carica
                </Button>
              </Stack>
            </Box>
          </Paper>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
            <Chip label={`${filteredProjects.length}/${projects.length} repositories`} variant="outlined" />
            <TextField
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca repo, branch o path"
              sx={{ width: { xs: "100%", md: 360 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
          </Stack>

          <DashboardMetrics stats={stats} />

          {isLoading ? (
            <Paper variant="outlined" sx={{ display: "grid", placeItems: "center", minHeight: 320 }}>
              <CircularProgress />
            </Paper>
          ) : viewMode === "map" ? (
            <WorkspaceMap
              root={data?.root ?? ""}
              projects={filteredProjects}
              onSelectProject={openProject}
            />
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
    </Box>
  );
}

function DashboardMetrics({ stats }: { stats: ReturnType<typeof getStats> }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr 1fr",
          md: "repeat(5, minmax(0, 1fr))"
        },
        gap: 1.5
      }}
    >
      <MetricTile label="Repos" value={stats.total} icon={<AccountTreeIcon />} color="#2563eb" />
      <MetricTile label="Puliti" value={stats.clean} icon={<CheckCircleIcon />} color="#2e7d32" />
      <MetricTile label="Da sistemare" value={stats.dirty} icon={<WarningAmberIcon />} color="#ed6c02" />
      <MetricTile label="Behind" value={stats.behind} icon={<SyncIcon />} color="#7b1fa2" />
      <MetricTile label="Compose" value={stats.compose} icon={<BuildIcon />} color="#00897b" />
    </Box>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minHeight: 86 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ color, display: "grid", placeItems: "center" }}>{icon}</Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function WorkspaceMap({
  root,
  projects,
  onSelectProject
}: {
  root: string;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
}) {
  const groups = React.useMemo(() => groupProjects(projects, root), [projects, root]);

  if (projects.length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
        <Typography>No Git repositories found.</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      {groups.map((group) => (
        <Box key={group.label}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
            <Typography variant="h2">{group.label}</Typography>
            <Chip size="small" label={group.projects.length} variant="outlined" />
          </Stack>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))"
              },
              gap: 1.5
            }}
          >
            {group.projects.map((project) => (
              <ProjectNode key={project.id} project={project} onClick={() => onSelectProject(project.id)} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

function ProjectNode({ project, onClick }: { project: ProjectSummary; onClick: () => void }) {
  const theme = useTheme();
  const tone = getProjectTone(project, theme.palette.mode);

  return (
    <Paper
      component="button"
      type="button"
      variant="outlined"
      onClick={onClick}
      sx={{
        minHeight: 150,
        width: "100%",
        p: 1.5,
        textAlign: "left",
        borderLeft: `5px solid ${tone.borderColor}`,
        background: tone.background,
        cursor: "pointer",
        transition: "border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
        "&:hover": {
          boxShadow:
            theme.palette.mode === "light"
              ? "0 8px 24px rgba(15, 23, 42, 0.12)"
              : "0 8px 24px rgba(0, 0, 0, 0.42)",
          transform: "translateY(-1px)"
        }
      }}
    >
      <Stack spacing={1} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
              {project.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {project.branch}
            </Typography>
          </Box>
          <Chip size="small" color={tone.chipColor} label={tone.label} />
        </Stack>

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
          {project.upstream ? <Chip size="small" variant="outlined" label={project.upstream} /> : null}
          {project.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${project.ahead}`} /> : null}
          {project.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${project.behind}`} /> : null}
          {project.hasDockerCompose ? <Chip size="small" label="compose" /> : null}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {project.lastCommit ? `${project.lastCommit.hash} - ${project.lastCommit.message}` : "No commits"}
        </Typography>
      </Stack>
    </Paper>
  );
}

function ProjectTable({
  projects,
  onSelectProject
}: {
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography>No Git repositories found.</Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Project</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Sync</TableCell>
            <TableCell>Last commit</TableCell>
            <TableCell>Path</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((project) => (
            <TableRow
              key={project.id}
              hover
              onClick={() => onSelectProject(project.id)}
              sx={{ cursor: "pointer" }}
            >
              <TableCell sx={{ fontWeight: 700 }}>{project.name}</TableCell>
              <TableCell>{project.branch}</TableCell>
              <TableCell>
                <StatusChips project={project} />
              </TableCell>
              <TableCell>
                <SyncChips project={project} />
              </TableCell>
              <TableCell sx={{ maxWidth: 340 }}>
                {project.lastCommit ? (
                  <Box>
                    <Typography variant="body2" noWrap>
                      {project.lastCommit.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {project.lastCommit.hash} by {project.lastCommit.author}
                    </Typography>
                  </Box>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell sx={{ fontFamily: "monospace", color: "text.secondary", maxWidth: 420 }} title={project.path}>
                <Typography variant="caption" noWrap component="div">
                  {project.path}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function ProjectOverlay({
  open,
  projects,
  activeProjectId,
  onActiveProjectChange,
  onCloseProject,
  onCloseOverlay,
  onRefresh
}: {
  open: boolean;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  onActiveProjectChange: (projectId: string) => void;
  onCloseProject: (projectId: string) => void;
  onCloseOverlay: () => void;
  onRefresh: () => void;
}) {
  const [resultsByProjectId, setResultsByProjectId] = React.useState<Record<string, CommandResult | null>>({});
  const activeValue = projects.some((project) => project.id === activeProjectId)
    ? activeProjectId
    : projects[0]?.id ?? false;

  React.useEffect(() => {
    const projectIds = new Set(projects.map((project) => project.id));
    setResultsByProjectId((currentResults) =>
      Object.fromEntries(Object.entries(currentResults).filter(([projectId]) => projectIds.has(projectId)))
    );
  }, [projects]);

  if (projects.length === 0) {
    return null;
  }

  function setProjectResult(projectId: string, result: CommandResult) {
    setResultsByProjectId((currentResults) => ({
      ...currentResults,
      [projectId]: result
    }));
  }

  return (
    <Dialog
      open={open}
      onClose={onCloseOverlay}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          height: { xs: "100dvh", md: "86dvh" },
          maxHeight: { xs: "100dvh", md: "86dvh" },
          m: { xs: 0, md: 2 },
          overflow: "hidden"
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
          <Tabs
            value={activeValue}
            onChange={(_, nextProjectId: string) => onActiveProjectChange(nextProjectId)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Open project tabs"
          >
            {projects.map((project) => (
              <Tab
                key={project.id}
                value={project.id}
                label={
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ maxWidth: 220 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                      {project.name}
                    </Typography>
                    {!project.isClean ? <WarningAmberIcon color="warning" fontSize="small" /> : null}
                  </Stack>
                }
              />
            ))}
          </Tabs>
        </Box>

        <Box sx={{ overflow: "auto", minHeight: 0 }}>
          {projects.map((project) => (
            <Box key={project.id} hidden={project.id !== activeValue}>
              <ProjectDetailPanel
                project={project}
                result={resultsByProjectId[project.id] ?? null}
                onClose={() => onCloseProject(project.id)}
                onResult={(result) => setProjectResult(project.id, result)}
                onRefresh={onRefresh}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDetailPanel({
  project,
  result,
  onClose,
  onResult,
  onRefresh
}: {
  project: ProjectSummary;
  result: CommandResult | null;
  onClose: () => void;
  onResult: (result: CommandResult) => void;
  onRefresh: () => void;
}) {
  const [detailTab, setDetailTab] = React.useState<ProjectDetailTab>("changes");
  const {
    data: gitDetails,
    isFetching: isFetchingGitDetails,
    refetch: refetchGitDetails
  } = useQuery({
    queryKey: ["project-git-details", project.id],
    queryFn: () => fetchGitDetails(project.id)
  });

  function refreshAfterGitAction() {
    void refetchGitDetails();
    onRefresh();
  }

  return (
    <Stack spacing={0}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 2 }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
            {project.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }} noWrap component="div">
            {project.path}
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close project tab">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Divider />

      <Box
        sx={{
          p: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
          gap: 2
        }}
      >
        <Stack spacing={2.25}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={gitDetails?.status.current ?? project.branch} color="primary" />
            <Chip
              color={(gitDetails?.status.isClean ?? project.isClean) ? "success" : "warning"}
              label={(gitDetails?.status.isClean ?? project.isClean) ? "clean" : "dirty"}
            />
            {project.hasDockerCompose ? <Chip label="compose" /> : null}
          </Stack>

          <DetailBlock title="Stato">
            <StatusChips project={project} />
            <SyncChips project={project} />
          </DetailBlock>

          <DetailBlock title="Ultimo commit">
            {project.lastCommit ? (
              <Stack spacing={0.5}>
                <Typography variant="body2">{project.lastCommit.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {project.lastCommit.hash} by {project.lastCommit.author} - {formatDate(project.lastCommit.date)}
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No commits
              </Typography>
            )}
          </DetailBlock>

          <DetailBlock title="Workspace">
            <ActionButton
              projectId={project.id}
              actionPath="open-vscode"
              label="Apri VS Code"
              icon={<OpenInNewIcon fontSize="small" />}
              onResult={onResult}
            />
          </DetailBlock>

          <DetailBlock title="Docker">
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <ActionButton
                projectId={project.id}
                actionPath="docker/up"
                label="Compose up"
                icon={<PlayArrowIcon fontSize="small" />}
                disabled={!project.hasDockerCompose}
                onResult={onResult}
                onCompleted={refreshAfterGitAction}
              />
              <ActionButton
                projectId={project.id}
                actionPath="docker/rebuild"
                label="Rebuild compose"
                icon={<BuildIcon fontSize="small" />}
                disabled={!project.hasDockerCompose}
                onResult={onResult}
                onCompleted={refreshAfterGitAction}
              />
            </Stack>
          </DetailBlock>
        </Stack>

        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ overflow: "hidden" }}>
            <Tabs
              value={detailTab}
              onChange={(_, nextTab: ProjectDetailTab) => setDetailTab(nextTab)}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="Project detail sections"
              sx={{ borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Tab value="changes" label="Changes" />
              <Tab value="branches" label="Branches" />
              <Tab value="terminal" label="Terminal" />
            </Tabs>

            <Box sx={{ p: 1.5 }}>
              {detailTab === "changes" ? (
                <ChangesPanel
                  projectId={project.id}
                  details={gitDetails}
                  isLoading={isFetchingGitDetails && !gitDetails}
                  onResult={onResult}
                  onCompleted={refreshAfterGitAction}
                />
              ) : null}

              {detailTab === "branches" ? (
                <BranchesPanel
                  projectId={project.id}
                  details={gitDetails}
                  isLoading={isFetchingGitDetails && !gitDetails}
                  onResult={onResult}
                  onCompleted={refreshAfterGitAction}
                />
              ) : null}

              {detailTab === "terminal" ? (
                <TerminalPanel projectId={project.id} onResult={onResult} onCompleted={refreshAfterGitAction} />
              ) : null}
            </Box>
          </Paper>

          {result ? <CommandOutput result={result} /> : null}
        </Stack>
      </Box>
    </Stack>
  );
}

function ChangesPanel({
  projectId,
  details,
  isLoading,
  onResult,
  onCompleted
}: {
  projectId: string;
  details: GitDetails | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
}) {
  const [commitMessage, setCommitMessage] = React.useState("");
  const [isCommitting, setIsCommitting] = React.useState(false);
  const files = details?.status.files;
  const totalChanges = files ? Object.values(files).reduce((total, group) => total + group.length, 0) : 0;
  const stagedCount = files?.staged.length ?? 0;

  async function commitChanges() {
    const message = commitMessage.trim();

    if (!message || stagedCount === 0 || isCommitting) {
      return;
    }

    setIsCommitting(true);

    try {
      const result = await runProjectAction(projectId, "git/commit", "Commit", { message });
      onResult(result);

      if (result.ok) {
        setCommitMessage("");
      }

      onCompleted();
    } catch (error) {
      onResult(commandErrorResult("Commit", error));
    } finally {
      setIsCommitting(false);
    }
  }

  function handleCommitKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commitChanges();
    }
  }

  if (isLoading) {
    return <LoadingPanel label="Caricamento changes" />;
  }

  if (!files) {
    return <EmptyPanel label="Changes non disponibili" />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip
          size="small"
          color={details.status.isClean ? "success" : "warning"}
          label={details.status.isClean ? "working tree clean" : `${totalChanges} changes`}
        />
        <Box sx={{ flexGrow: 1 }} />
        <ActionButton
          projectId={projectId}
          actionPath="git/stage-all"
          label="Stage all"
          icon={<AddIcon fontSize="small" />}
          disabled={totalChanges === 0}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="git/unstage-all"
          label="Unstage all"
          icon={<UndoIcon fontSize="small" />}
          disabled={stagedCount === 0}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 1
        }}
      >
        <ChangeGroup title="Staged" files={files.staged} color="success.main" />
        <ChangeGroup title="Modified" files={files.modified} color="warning.main" />
        <ChangeGroup title="Deleted" files={files.deleted} color="error.main" />
        <ChangeGroup title="Renamed" files={files.renamed} color="info.main" />
        <ChangeGroup title="Untracked" files={files.untracked} color="text.secondary" />
        {files.conflicted.length > 0 ? (
          <ChangeGroup title="Conflicted" files={files.conflicted} color="error.main" />
        ) : null}
      </Box>

      <Divider />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <TextField
          size="small"
          label="Commit message"
          value={commitMessage}
          onChange={(event) => setCommitMessage(event.target.value)}
          onKeyDown={handleCommitKeyDown}
          disabled={stagedCount === 0}
          fullWidth
        />
        <Button
          variant="contained"
          startIcon={isCommitting ? <CircularProgress color="inherit" size={16} /> : <CheckCircleIcon />}
          onClick={commitChanges}
          disabled={isCommitting || stagedCount === 0 || commitMessage.trim().length === 0}
          sx={{ minWidth: 112 }}
        >
          Commit
        </Button>
        <ActionButton
          projectId={projectId}
          actionPath="git/push"
          label="Push"
          icon={<CloudUploadIcon fontSize="small" />}
          disabled={!details.status.tracking}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>
    </Stack>
  );
}

function ChangeGroup({ title, files, color }: { title: string; files: string[]; color: string }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        minHeight: 128,
        overflow: "hidden"
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />
        <Typography variant="body2" sx={{ fontWeight: 800, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={files.length} />
      </Stack>
      <Box sx={{ px: 1.25, py: 1, maxHeight: 150, overflow: "auto" }}>
        {files.length > 0 ? (
          files.map((file) => (
            <Typography
              key={`${title}-${file}`}
              variant="caption"
              component="div"
              sx={{ fontFamily: "monospace", overflowWrap: "anywhere", py: 0.25 }}
            >
              {file}
            </Typography>
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Nessun file
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function BranchesPanel({
  projectId,
  details,
  isLoading,
  onResult,
  onCompleted
}: {
  projectId: string;
  details: GitDetails | undefined;
  isLoading: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
}) {
  const [newBranchName, setNewBranchName] = React.useState("");
  const [runningBranchAction, setRunningBranchAction] = React.useState<string | null>(null);
  const isDirty = details ? !details.status.isClean : false;

  async function runBranchAction(actionKey: string, label: string, actionPath: string, body?: unknown) {
    setRunningBranchAction(actionKey);

    try {
      const result = await runProjectAction(projectId, actionPath, label, body);
      onResult(result);

      if (result.ok && actionPath === "git/branch") {
        setNewBranchName("");
      }

      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(label, error));
    } finally {
      setRunningBranchAction(null);
    }
  }

  function createBranch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const branch = newBranchName.trim();

    if (!branch || isDirty) {
      return;
    }

    void runBranchAction("create", `Create branch ${branch}`, "git/branch", { branch });
  }

  if (isLoading) {
    return <LoadingPanel label="Caricamento branches" />;
  }

  if (!details) {
    return <EmptyPanel label="Branches non disponibili" />;
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
        <Chip color="primary" label={details.status.current} />
        {details.status.tracking ? <Chip variant="outlined" label={details.status.tracking} /> : null}
        {details.status.ahead > 0 ? <Chip color="info" label={`ahead ${details.status.ahead}`} /> : null}
        {details.status.behind > 0 ? <Chip color="secondary" label={`behind ${details.status.behind}`} /> : null}
        {isDirty ? <Chip color="warning" label="checkout bloccato: dirty" /> : null}
        <Box sx={{ flexGrow: 1 }} />
        <ActionButton
          projectId={projectId}
          actionPath="git/fetch"
          label="Fetch"
          icon={<CloudDownloadIcon fontSize="small" />}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="git/pull"
          label="Pull ff-only"
          icon={<SyncIcon fontSize="small" />}
          disabled={!details.status.tracking}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>

      <Box component="form" onSubmit={createBranch}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <TextField
            size="small"
            label="Nuovo branch"
            value={newBranchName}
            onChange={(event) => setNewBranchName(event.target.value)}
            disabled={isDirty}
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={runningBranchAction === "create" ? <CircularProgress color="inherit" size={16} /> : <AddIcon />}
            disabled={isDirty || newBranchName.trim().length === 0 || runningBranchAction === "create"}
            sx={{ minWidth: 138 }}
          >
            Create
          </Button>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" },
          gap: 1
        }}
      >
        <BranchGroup
          title="Local branches"
          branches={details.branches.local}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(`checkout:${branch.name}`, `Checkout ${branch.name}`, "git/checkout", {
              branch: branch.name,
              remote: false
            })
          }
        />
        <BranchGroup
          title="Remote branches"
          branches={details.branches.remote}
          isDirty={isDirty}
          runningBranchAction={runningBranchAction}
          onCheckout={(branch) =>
            runBranchAction(`checkout:${branch.name}`, `Checkout ${branch.name}`, "git/checkout", {
              branch: branch.name,
              remote: true
            })
          }
        />
      </Box>
    </Stack>
  );
}

function BranchGroup({
  title,
  branches,
  isDirty,
  runningBranchAction,
  onCheckout
}: {
  title: string;
  branches: GitBranchInfo[];
  isDirty: boolean;
  runningBranchAction: string | null;
  onCheckout: (branch: GitBranchInfo) => void;
}) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ px: 1.25, py: 1, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <AccountTreeIcon fontSize="small" color="primary" />
        <Typography variant="body2" sx={{ fontWeight: 800, flexGrow: 1 }}>
          {title}
        </Typography>
        <Chip size="small" label={branches.length} />
      </Stack>
      <Stack spacing={0.75} sx={{ p: 1, maxHeight: 320, overflow: "auto" }}>
        {branches.length > 0 ? (
          branches.map((branch) => (
            <BranchRow
              key={`${title}-${branch.name}`}
              branch={branch}
              isDirty={isDirty}
              isRunning={runningBranchAction === `checkout:${branch.name}`}
              onCheckout={() => onCheckout(branch)}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            Nessun branch
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

function BranchRow({
  branch,
  isDirty,
  isRunning,
  onCheckout
}: {
  branch: GitBranchInfo;
  isDirty: boolean;
  isRunning: boolean;
  onCheckout: () => void;
}) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: branch.current ? "primary.main" : "divider",
        borderRadius: 1,
        p: 1
      }}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {branch.name}
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            {branch.current ? <Chip size="small" color="primary" label="current" /> : null}
            {branch.remote ? <Chip size="small" variant="outlined" label="remote" /> : null}
            {branch.upstream ? <Chip size="small" variant="outlined" label={branch.upstream} /> : null}
            {branch.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${branch.ahead}`} /> : null}
            {branch.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${branch.behind}`} /> : null}
          </Stack>
        </Box>
        <Button
          size="small"
          variant={branch.current ? "contained" : "outlined"}
          onClick={onCheckout}
          disabled={branch.current || isDirty || isRunning}
          startIcon={isRunning ? <CircularProgress size={14} /> : <AccountTreeIcon fontSize="small" />}
          sx={{ minWidth: 106 }}
        >
          Checkout
        </Button>
      </Stack>
    </Box>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: 220 }}>
      <Stack spacing={1} alignItems="center">
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Stack spacing={1}>{children}</Stack>
    </Box>
  );
}

function TerminalPanel({
  projectId,
  onResult,
  onCompleted
}: {
  projectId: string;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
}) {
  const [command, setCommand] = React.useState("git status --short --branch");
  const [isRunning, setIsRunning] = React.useState(false);

  async function runCommand() {
    const nextCommand = command.trim();

    if (!nextCommand || isRunning) {
      return;
    }

    setIsRunning(true);

    try {
      const result = await runTerminalCommand(projectId, nextCommand);
      onResult(result);
      onCompleted();
    } catch (error) {
      onResult(commandErrorResult(nextCommand, error));
    } finally {
      setIsRunning(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void runCommand();
    }
  }

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <TextField
        size="small"
        label="Comando"
        value={command}
        onChange={(event) => setCommand(event.target.value)}
        onKeyDown={handleKeyDown}
        fullWidth
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <TerminalIcon fontSize="small" />
            </InputAdornment>
          )
        }}
      />
      <Button
        variant="contained"
        startIcon={isRunning ? <CircularProgress color="inherit" size={16} /> : <TerminalIcon />}
        onClick={runCommand}
        disabled={isRunning || command.trim().length === 0}
        sx={{ minWidth: 112 }}
      >
        Esegui
      </Button>
    </Stack>
  );
}

function ActionButton({
  projectId,
  actionPath,
  label,
  icon,
  body,
  disabled = false,
  onResult,
  onCompleted
}: {
  projectId: string;
  actionPath: string;
  label: string;
  icon: React.ReactNode;
  body?: unknown;
  disabled?: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted?: () => void;
}) {
  const [isRunning, setIsRunning] = React.useState(false);

  async function runAction() {
    setIsRunning(true);

    try {
      const result = await runProjectAction(projectId, actionPath, label, body);
      onResult(result);
      onCompleted?.();
    } catch (error) {
      onResult(commandErrorResult(label, error));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Button size="small" variant="contained" startIcon={isRunning ? <CircularProgress size={16} /> : icon} onClick={runAction} disabled={disabled || isRunning}>
      {label}
    </Button>
  );
}

function commandErrorResult(command: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : "Command failed";

  return {
    ok: false,
    command,
    exitCode: null,
    stdout: "",
    stderr: message,
    output: message,
    durationMs: 0
  };
}

function CommandOutput({ result }: { result: CommandResult }) {
  const theme = useTheme();
  const statusColor = result.ok ? theme.palette.success.main : theme.palette.warning.main;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ p: 1.25, bgcolor: alpha(statusColor, theme.palette.mode === "light" ? 0.12 : 0.2) }}
      >
        {result.ok ? <CheckCircleIcon color="success" fontSize="small" /> : <WarningAmberIcon color="warning" fontSize="small" />}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {result.command}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            exit {result.exitCode ?? "n/a"} - {result.durationMs}ms
          </Typography>
        </Box>
      </Stack>
      {result.output ? (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            maxHeight: 280,
            overflow: "auto",
            bgcolor: theme.palette.mode === "light" ? "#0f172a" : "#05070a",
            color: "#e5e7eb",
            fontSize: 12,
            whiteSpace: "pre-wrap"
          }}
        >
          {result.output}
        </Box>
      ) : (
        <Box sx={{ p: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Done
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

function StatusChips({ project }: { project: ProjectSummary }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      <Chip size="small" color={project.isClean ? "success" : "warning"} label={project.isClean ? "clean" : "dirty"} />
      {project.staged > 0 ? <Chip size="small" label={`${project.staged} staged`} /> : null}
      {project.modified > 0 ? <Chip size="small" label={`${project.modified} modified`} /> : null}
      {project.untracked > 0 ? <Chip size="small" label={`${project.untracked} untracked`} /> : null}
    </Stack>
  );
}

function SyncChips({ project }: { project: ProjectSummary }) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
      {project.upstream ? (
        <Chip size="small" variant="outlined" label={project.upstream} />
      ) : (
        <Chip size="small" variant="outlined" label="no upstream" />
      )}
      {project.ahead > 0 ? <Chip size="small" color="info" label={`ahead ${project.ahead}`} /> : null}
      {project.behind > 0 ? <Chip size="small" color="secondary" label={`behind ${project.behind}`} /> : null}
    </Stack>
  );
}

function isProject(project: ProjectSummary | undefined): project is ProjectSummary {
  return project !== undefined;
}

function getStats(projects: ProjectSummary[]) {
  return {
    total: projects.length,
    clean: projects.filter((project) => project.isClean).length,
    dirty: projects.filter((project) => !project.isClean).length,
    behind: projects.filter((project) => project.behind > 0).length,
    compose: projects.filter((project) => project.hasDockerCompose).length
  };
}

function filterProjects(projects: ProjectSummary[], search: string): ProjectSummary[] {
  const query = search.trim().toLowerCase();

  if (!query) {
    return projects;
  }

  return projects.filter((project) =>
    [project.name, project.path, project.branch, project.upstream ?? ""].some((value) =>
      value.toLowerCase().includes(query)
    )
  );
}

function groupProjects(projects: ProjectSummary[], root: string) {
  const groups = new Map<string, ProjectSummary[]>();

  for (const project of projects) {
    const label = getGroupLabel(project, root);
    groups.set(label, [...(groups.get(label) ?? []), project]);
  }

  return [...groups.entries()]
    .map(([label, groupProjects]) => ({
      label,
      projects: groupProjects.sort(sortProjectsForMap)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function getGroupLabel(project: ProjectSummary, root: string): string {
  const normalizedRoot = root.replace(/\/+$/, "");
  const relativePath = project.path.startsWith(normalizedRoot)
    ? project.path.slice(normalizedRoot.length).replace(/^\/+/, "")
    : project.path;
  const parts = relativePath.split("/").filter(Boolean);

  return parts.length > 1 ? parts[0] : "root";
}

function sortProjectsForMap(a: ProjectSummary, b: ProjectSummary): number {
  const priorityA = getProjectPriority(a);
  const priorityB = getProjectPriority(b);

  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  return a.name.localeCompare(b.name);
}

function getProjectPriority(project: ProjectSummary): number {
  return Number(!project.isClean) * 4 + Number(project.behind > 0) * 3 + Number(project.ahead > 0) * 2;
}

function getProjectTone(project: ProjectSummary, colorMode: ColorMode): ProjectTone {
  if (!project.isClean) {
    return {
      label: "dirty",
      chipColor: "warning",
      borderColor: "#ed6c02",
      background: colorMode === "light" ? "#fffaf2" : "#2a1d12"
    };
  }

  if (project.behind > 0) {
    return {
      label: "behind",
      chipColor: "secondary",
      borderColor: "#7b1fa2",
      background: colorMode === "light" ? "#fbf7ff" : "#241730"
    };
  }

  if (project.ahead > 0) {
    return {
      label: "ahead",
      chipColor: "info",
      borderColor: "#0288d1",
      background: colorMode === "light" ? "#f3fbff" : "#102335"
    };
  }

  return {
    label: "clean",
    chipColor: "success",
    borderColor: "#2e7d32",
    background: colorMode === "light" ? "#f7fff8" : "#122418"
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

async function runProjectAction(
  projectId: string,
  actionPath: string,
  label: string,
  body?: unknown
): Promise<CommandResult> {
  const response = await fetch(`/api/projects/${projectId}/${actionPath}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "Action failed");
  }

  if (payload && "command" in payload) {
    return payload as CommandResult;
  }

  return {
    ok: true,
    command: label,
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "Requested",
    durationMs: 0
  };
}

async function fetchGitDetails(projectId: string): Promise<GitDetails> {
  const response = await fetch(`/api/projects/${projectId}/git/details`);

  if (!response.ok) {
    throw new Error("Unable to load Git details");
  }

  return response.json();
}

async function runTerminalCommand(projectId: string, command: string): Promise<CommandResult> {
  const response = await fetch(`/api/projects/${projectId}/terminal/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ command })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Command failed");
  }

  return payload as CommandResult;
}

async function setRootPath(root: string): Promise<{ root: string }> {
  const response = await fetch("/api/root", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ root })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to change folder");
  }

  return { root: payload.root };
}

async function fetchProjects(): Promise<ProjectsResponse> {
  const response = await fetch("/api/projects");

  if (!response.ok) {
    throw new Error("Unable to load projects");
  }

  return response.json();
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
