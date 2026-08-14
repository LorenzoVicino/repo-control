import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CommitIcon from "@mui/icons-material/Commit";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import TerminalIcon from "@mui/icons-material/Terminal";
import { Badge, Box, Chip, CircularProgress, Divider, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchDockerComposeProject } from "../../api/docker";
import { fetchGitActivity, fetchGitDetails } from "../../api/projects";
import type { CommandResult } from "../../types/common";
import type { ProjectDetailTab, ProjectSummary } from "../../types/projects";
import { BranchesPanel } from "./BranchesPanel";
import { ChangesPanel } from "./ChangesPanel";
import { DockerDetailPanel } from "./DockerDetailPanel";
import { RepositoryOverviewPanel } from "./RepositoryOverviewPanel";
import { TerminalPanel } from "./TerminalPanel";

const GIT_ACTIVITY_PAGE_SIZE = 6;
const GIT_DETAILS_STALE_TIME_MS = 15 * 1000;
const GIT_ACTIVITY_STALE_TIME_MS = 60 * 1000;
const DOCKER_STALE_TIME_MS = 15 * 1000;

type ProjectDetailPanelProps = {
  project: ProjectSummary;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: (projectId: string) => void;
  onResult: (result: CommandResult) => void;
  onRefresh: (projectId: string) => void;
};

export const ProjectDetailPanel = React.memo(function ProjectDetailPanel({
  project,
  isActive,
  isFavorite,
  onToggleFavorite,
  onResult,
  onRefresh
}: ProjectDetailPanelProps) {
  const [detailTab, setDetailTab] = React.useState<ProjectDetailTab>("overview");
  const [mountedTabs, setMountedTabs] = React.useState<Set<ProjectDetailTab>>(() => new Set(["overview"]));
  const needsGitDetails = detailTab === "overview" || detailTab === "git" || detailTab === "branches";
  const needsDocker = project.hasDockerCompose && (detailTab === "overview" || detailTab === "docker");

  React.useEffect(() => {
    if (!project.hasDockerCompose && detailTab === "docker") setDetailTab("overview");
  }, [detailTab, project.hasDockerCompose]);

  const {
    data: gitDetails,
    isFetching: isFetchingGitDetails,
    refetch: refetchGitDetails
  } = useQuery({
    queryKey: ["project-git-details", project.id],
    queryFn: () => fetchGitDetails(project.id),
    enabled: isActive && needsGitDetails,
    staleTime: GIT_DETAILS_STALE_TIME_MS
  });
  const {
    data: gitActivityPages,
    isFetching: isFetchingGitActivity,
    isFetchingNextPage: isFetchingNextGitActivityPage,
    hasNextPage: hasNextGitActivityPage,
    fetchNextPage: fetchNextGitActivityPage,
    refetch: refetchGitActivity
  } = useInfiniteQuery({
    queryKey: ["project-git-activity", project.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchGitActivity(project.id, { offset: Number(pageParam), limit: GIT_ACTIVITY_PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    enabled: isActive && detailTab === "overview",
    staleTime: GIT_ACTIVITY_STALE_TIME_MS
  });
  const {
    data: dockerProject,
    isFetching: isFetchingDocker,
    refetch: refetchDocker
  } = useQuery({
    queryKey: ["project-docker-compose", project.id],
    queryFn: () => fetchDockerComposeProject(project.id),
    enabled: isActive && needsDocker,
    staleTime: DOCKER_STALE_TIME_MS,
    refetchInterval: isActive && needsDocker ? 30_000 : false,
    refetchIntervalInBackground: false
  });

  const commits = React.useMemo(
    () => gitActivityPages?.pages.flatMap((page) => page.commits) ?? [],
    [gitActivityPages]
  );
  const totalChanges = (gitDetails?.status.files.staged.length ?? project.staged)
    + (gitDetails?.status.files.unstaged.length ?? project.modified + project.untracked);

  function selectTab(tab: ProjectDetailTab) {
    setDetailTab(tab);
    setMountedTabs((current) => {
      if (current.has(tab)) return current;
      return new Set([...current, tab]);
    });
  }

  function refreshAfterProjectAction() {
    void refetchGitDetails();
    void refetchGitActivity();
    if (project.hasDockerCompose) void refetchDocker();
    onRefresh(project.id);
  }

  function refreshCurrentTab() {
    if (needsGitDetails) void refetchGitDetails();
    if (detailTab === "overview") void refetchGitActivity();
    if (needsDocker) void refetchDocker();
    onRefresh(project.id);
  }

  return (
    <Stack component="section" aria-label={`Dettaglio repository ${project.name}`} sx={{ minHeight: "100%", height: "100%", overflow: "hidden" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: { xs: 1.25, md: 1.75 }, py: 1, minHeight: 60, bgcolor: "background.paper" }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            borderRadius: 1,
            color: "primary.light",
            border: "1px solid",
            borderColor: "primary.main",
            bgcolor: "var(--rc-accent-tint)"
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="overline" color="text.secondary" component="div">
            Repository
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography component="h1" variant="h5" noWrap sx={{ maxWidth: { xs: 180, sm: "none" } }}>{project.name}</Typography>
            <Chip size="small" label={gitDetails?.status.current ?? project.branch} color="primary" variant="outlined" />
            <Chip
              size="small"
              color={(gitDetails?.status.isClean ?? project.isClean) ? "success" : "warning"}
              label={(gitDetails?.status.isClean ?? project.isClean) ? "pulito" : `${totalChanges} modifiche`}
            />
            {(gitDetails?.status.behind ?? project.behind) > 0 ? (
              <Chip size="small" color="warning" label={`${gitDetails?.status.behind ?? project.behind} behind`} />
            ) : null}
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              maxWidth: { xs: 240, sm: 560, lg: 820 },
              direction: "rtl",
              textAlign: "left",
              fontFamily: "var(--rc-font-mono)",
              fontSize: 9.5
            }}
            noWrap
            component="div"
            title={project.path}
          >
            {project.path}
          </Typography>
        </Box>
        {(isFetchingGitDetails || isFetchingDocker) ? <CircularProgress size={17} /> : null}
        <Tooltip title="Aggiorna repository">
          <IconButton onClick={refreshCurrentTab} aria-label="Aggiorna repository"><RefreshIcon /></IconButton>
        </Tooltip>
        <Tooltip title={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
          <IconButton
            onClick={() => onToggleFavorite(project.id)}
            color={isFavorite ? "warning" : "default"}
            aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider />

      <ProjectDetailTabs
        value={detailTab}
        hasDockerCompose={project.hasDockerCompose}
        changeCount={totalChanges}
        behindCount={gitDetails?.status.behind ?? project.behind}
        dockerRunning={dockerProject?.services.filter((service) => service.state.toLowerCase() === "running").length ?? 0}
        dockerTotal={dockerProject?.services.length ?? 0}
        onChange={selectTab}
      />

      <Box sx={{ minHeight: 0, flexGrow: 1, overflow: "auto", p: { xs: 1, md: 1.25 } }}>
        {detailTab === "overview" ? (
          <RepositoryOverviewPanel
            project={project}
            details={gitDetails}
            commits={commits}
            dockerProject={dockerProject}
            isLoading={isFetchingGitActivity && commits.length === 0}
            isLoadingMore={isFetchingNextGitActivityPage}
            hasMore={Boolean(hasNextGitActivityPage)}
            onLoadMore={() => void fetchNextGitActivityPage()}
            onResult={onResult}
            onCompleted={refreshAfterProjectAction}
          />
        ) : null}

        {detailTab === "git" ? (
          <ChangesPanel
            projectId={project.id}
            details={gitDetails}
            isLoading={isFetchingGitDetails && !gitDetails}
            onResult={onResult}
            onCompleted={refreshAfterProjectAction}
          />
        ) : null}

        {detailTab === "branches" ? (
          <BranchesPanel
            projectId={project.id}
            details={gitDetails}
            isLoading={isFetchingGitDetails && !gitDetails}
            onResult={onResult}
            onCompleted={refreshAfterProjectAction}
          />
        ) : null}

        {mountedTabs.has("terminal") ? (
          <Box sx={{ display: detailTab === "terminal" ? "block" : "none" }}>
            <TerminalPanel
              projectId={project.id}
              projectName={project.name}
              projectPath={project.path}
              branch={gitDetails?.status.current ?? project.branch}
              hasDockerCompose={project.hasDockerCompose}
              composeServiceCount={dockerProject?.services.length}
              onResult={onResult}
              onCompleted={refreshAfterProjectAction}
            />
          </Box>
        ) : null}

        {detailTab === "docker" && project.hasDockerCompose ? (
          <DockerDetailPanel
            projectId={project.id}
            compose={dockerProject}
            isLoading={isFetchingDocker}
            onResult={onResult}
            onCompleted={refreshAfterProjectAction}
          />
        ) : null}
      </Box>
    </Stack>
  );
});

type ProjectDetailTabsProps = {
  value: ProjectDetailTab;
  hasDockerCompose: boolean;
  changeCount: number;
  behindCount: number;
  dockerRunning: number;
  dockerTotal: number;
  onChange: (tab: ProjectDetailTab) => void;
};

function ProjectDetailTabs({
  value,
  hasDockerCompose,
  changeCount,
  behindCount,
  dockerRunning,
  dockerTotal,
  onChange
}: ProjectDetailTabsProps) {
  const tabs: Array<{ value: ProjectDetailTab; label: React.ReactNode; icon: React.ReactElement }> = [
    { value: "overview", label: "Panoramica", icon: <DashboardOutlinedIcon /> },
    {
      value: "git",
      label: <TabLabel label="Modifiche" badge={changeCount > 0 ? String(changeCount) : null} />,
      icon: <CommitIcon />
    },
    {
      value: "branches",
      label: <TabLabel label="Branch" badge={behindCount > 0 ? `↓${behindCount}` : null} />,
      icon: <AccountTreeIcon />
    },
    { value: "terminal", label: "Terminale", icon: <TerminalIcon /> }
  ];
  if (hasDockerCompose) {
    tabs.push({
      value: "docker",
      label: <TabLabel label="Docker" badge={dockerTotal > 0 ? `${dockerRunning}/${dockerTotal}` : null} />,
      icon: <Inventory2OutlinedIcon />
    });
  }

  return (
    <Tabs
      value={value}
      onChange={(_, nextTab: ProjectDetailTab) => onChange(nextTab)}
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Sezioni progetto"
      sx={{
        minHeight: 42,
        px: { xs: 0.5, md: 1.25 },
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        "& .MuiTab-root": { minHeight: 42, px: 1.25 },
        "& .MuiTab-iconWrapper": { fontSize: 17, mr: 0.65 }
      }}
    >
      {tabs.map((tab) => <Tab key={tab.value} value={tab.value} label={tab.label} icon={tab.icon} iconPosition="start" />)}
    </Tabs>
  );
}

function TabLabel({ label, badge }: { label: string; badge: string | null }) {
  return badge ? (
    <Badge
      badgeContent={badge}
      color="primary"
      sx={{ "& .MuiBadge-badge": { position: "static", transform: "none", ml: 0.7, minWidth: 19, height: 19, px: 0.55 } }}
    >
      <span>{label}</span>
    </Badge>
  ) : <span>{label}</span>;
}
