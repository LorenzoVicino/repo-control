import BuildIcon from "@mui/icons-material/Build";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { Box, Button, Chip, CircularProgress, Divider, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchDockerContainers, fetchGitActivity, fetchGitDetails } from "../../api/client";
import { ActionButton } from "../shared/ActionButton";
import { DetailBlock } from "../shared/DetailBlock";
import { BranchesPanel } from "./BranchesPanel";
import { ChangesPanel } from "./ChangesPanel";
import { TerminalPanel } from "./TerminalPanel";
import type {
  CommandResult,
  DockerContainerGroup,
  GitActivityCommit,
  ProjectDetailTab,
  ProjectSummary
} from "../../types";
import { formatDate } from "../../utils/projects";

const DOCKER_POLL_INTERVAL_MS = 30 * 1000;
const GIT_ACTIVITY_PAGE_SIZE = 12;

type ProjectDetailPanelProps = {
  project: ProjectSummary;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onResult: (result: CommandResult) => void;
  onRefresh: () => void;
};

export function ProjectDetailPanel({
  project,
  isFavorite,
  onClose,
  onToggleFavorite,
  onResult,
  onRefresh
}: ProjectDetailPanelProps) {
  const [detailTab, setDetailTab] = React.useState<ProjectDetailTab>("git");
  const {
    data: gitDetails,
    isFetching: isFetchingGitDetails,
    refetch: refetchGitDetails
  } = useQuery({
    queryKey: ["project-git-details", project.id],
    queryFn: () => fetchGitDetails(project.id)
  });
  const {
    data: gitActivityPages,
    isFetching: isFetchingGitActivity,
    isFetchingNextPage: isFetchingNextGitActivityPage,
    hasNextPage: hasNextGitActivityPage,
    fetchNextPage: fetchNextGitActivityPage
  } = useInfiniteQuery({
    queryKey: ["project-git-activity", project.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchGitActivity(project.id, { offset: Number(pageParam), limit: GIT_ACTIVITY_PAGE_SIZE }),
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined
  });
  const {
    data: dockerStatus,
    refetch: refetchDockerContainers
  } = useQuery({
    queryKey: ["docker-containers"],
    queryFn: fetchDockerContainers,
    refetchInterval: DOCKER_POLL_INTERVAL_MS
  });
  const dockerGroup = React.useMemo(
    () => findDockerGroupForProject(dockerStatus?.groups ?? [], project),
    [dockerStatus?.groups, project]
  );
  const isDockerAvailable = dockerStatus?.ok === true;
  const isDockerRunning = Boolean(dockerGroup && dockerGroup.containers.length > 0);
  const canStartCompose = project.hasDockerCompose && isDockerAvailable && !isDockerRunning;
  const canRebuildCompose = project.hasDockerCompose && isDockerAvailable;
  const canStopCompose = project.hasDockerCompose && isDockerAvailable && isDockerRunning;
  const gitActivityCommits = React.useMemo(
    () => gitActivityPages?.pages.flatMap((page) => page.commits) ?? [],
    [gitActivityPages]
  );
  const loadMoreGitActivity = React.useCallback(() => {
    if (!hasNextGitActivityPage || isFetchingNextGitActivityPage) {
      return;
    }

    void fetchNextGitActivityPage();
  }, [fetchNextGitActivityPage, hasNextGitActivityPage, isFetchingNextGitActivityPage]);

  function refreshAfterProjectAction() {
    void refetchGitDetails();
    void refetchDockerContainers();
    onRefresh();
  }

  return (
    <Stack spacing={0} sx={{ minHeight: "100%", height: "100%", overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 2.25 }}>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
            {project.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }} noWrap component="div">
            {project.path}
          </Typography>
        </Box>
        <Tooltip title={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}>
          <IconButton
            onClick={onToggleFavorite}
            color={isFavorite ? "warning" : "default"}
            aria-label={isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Tooltip>
        <IconButton onClick={onClose} aria-label="Close project tab">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Divider />

      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
          gap: { xs: 1.5, lg: 2 },
          minHeight: 0,
          flexGrow: 1,
          height: { lg: "100%" },
          overflow: { lg: "hidden" }
        }}
      >
        <Stack spacing={1.5} sx={{ minWidth: 0, minHeight: 0, height: "100%", overflow: "hidden" }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={gitDetails?.status.current ?? project.branch} color="primary" />
            <Chip
              color={(gitDetails?.status.isClean ?? project.isClean) ? "success" : "warning"}
              label={(gitDetails?.status.isClean ?? project.isClean) ? "clean" : "dirty"}
            />
            {project.hasDockerCompose ? (
              <Chip
                label={getDockerStatusLabel(isDockerAvailable, isDockerRunning)}
                color={isDockerRunning ? "success" : isDockerAvailable ? "default" : "warning"}
                variant={isDockerRunning ? "filled" : "outlined"}
              />
            ) : null}
          </Stack>

          <DetailBlock title="Quick actions">
            <Stack spacing={0.75}>
              <ActionButton
                projectId={project.id}
                actionPath="open-vscode"
                label="VS Code"
                icon={<OpenInNewIcon fontSize="small" />}
                onResult={onResult}
              />
              <ActionButton
                projectId={project.id}
                actionPath="docker/up"
                label="Docker compose up"
                icon={<PlayArrowIcon fontSize="small" />}
                disabled={!canStartCompose}
                onResult={onResult}
                onCompleted={refreshAfterProjectAction}
              />
              <ActionButton
                projectId={project.id}
                actionPath="docker/rebuild"
                label="Rebuild compose"
                icon={<BuildIcon fontSize="small" />}
                disabled={!canRebuildCompose}
                onResult={onResult}
                onCompleted={refreshAfterProjectAction}
              />
              <ActionButton
                projectId={project.id}
                actionPath="docker/stop"
                label="Stop compose"
                icon={<StopCircleIcon fontSize="small" />}
                disabled={!canStopCompose}
                onResult={onResult}
                onCompleted={refreshAfterProjectAction}
              />
            </Stack>
          </DetailBlock>

          <GitActivityGraph
            commits={gitActivityCommits}
            isLoading={isFetchingGitActivity && !gitActivityPages}
            isLoadingMore={isFetchingNextGitActivityPage}
            hasMore={Boolean(hasNextGitActivityPage)}
            onLoadMore={loadMoreGitActivity}
          />
        </Stack>

        <Stack spacing={1.25} sx={{ minWidth: 0, minHeight: 0, height: "100%", overflow: "hidden" }}>
          <ProjectDetailTabs value={detailTab} onChange={setDetailTab} />

          <Paper
            variant="outlined"
            sx={{
              overflow: "hidden",
              bgcolor: "background.paper",
              minHeight: 0,
              flexGrow: 1,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <Box sx={{ p: { xs: 1, md: 1.5 }, minHeight: 0, height: "100%", overflow: "auto" }}>
              {detailTab === "git" ? (
                <ChangesPanel
                  projectId={project.id}
                  details={gitDetails}
                  isLoading={isFetchingGitDetails && !gitDetails}
                  onResult={onResult}
                  onCompleted={refreshAfterProjectAction}
                />
              ) : null}

              {detailTab === "docker" ? (
                <DockerDetailPanel
                  projectId={project.id}
                  hasDockerCompose={project.hasDockerCompose}
                  isDockerAvailable={isDockerAvailable}
                  isDockerRunning={isDockerRunning}
                  onResult={onResult}
                  onCompleted={refreshAfterProjectAction}
                />
              ) : null}

              {detailTab === "deploy" ? (
                <PlaceholderPanel
                  title="Deploy"
                  body="Spazio predisposto per azioni di deploy configurabili per progetto."
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

              {detailTab === "terminal" ? (
                <TerminalPanel
                  projectId={project.id}
                  projectName={project.name}
                  projectPath={project.path}
                  onResult={onResult}
                  onCompleted={refreshAfterProjectAction}
                />
              ) : null}
            </Box>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}

type ProjectDetailTabsProps = {
  value: ProjectDetailTab;
  onChange: (tab: ProjectDetailTab) => void;
};

const PROJECT_DETAIL_TABS: Array<{ value: ProjectDetailTab; label: string }> = [
  { value: "git", label: "Git" },
  { value: "branches", label: "Branches" },
  { value: "terminal", label: "Terminal" },
  { value: "docker", label: "Docker" },
  { value: "deploy", label: "Deploy" }
];

function ProjectDetailTabs({ value, onChange }: ProjectDetailTabsProps) {
  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" role="tablist" aria-label="Project detail sections">
      {PROJECT_DETAIL_TABS.map((tab) => {
        const isSelected = value === tab.value;

        return (
          <Button
            key={tab.value}
            role="tab"
            aria-selected={isSelected}
            size="small"
            variant={isSelected ? "contained" : "outlined"}
            onClick={() => onChange(tab.value)}
            sx={{
              minWidth: { xs: 92, md: 108 },
              justifyContent: "flex-start",
              borderRadius: 0,
              fontWeight: 800
            }}
          >
            {tab.label}
          </Button>
        );
      })}
    </Stack>
  );
}

type DockerDetailPanelProps = {
  projectId: string;
  hasDockerCompose: boolean;
  isDockerAvailable: boolean;
  isDockerRunning: boolean;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

function DockerDetailPanel({
  projectId,
  hasDockerCompose,
  isDockerAvailable,
  isDockerRunning,
  onResult,
  onCompleted
}: DockerDetailPanelProps) {
  const canStartCompose = hasDockerCompose && isDockerAvailable && !isDockerRunning;
  const canRebuildCompose = hasDockerCompose && isDockerAvailable;
  const canStopCompose = hasDockerCompose && isDockerAvailable && isDockerRunning;

  return (
    <Stack spacing={1.5}>
      {hasDockerCompose ? (
        <Chip
          size="small"
          label={getDockerStatusLabel(isDockerAvailable, isDockerRunning)}
          color={isDockerRunning ? "success" : isDockerAvailable ? "default" : "warning"}
          variant={isDockerRunning ? "filled" : "outlined"}
          sx={{ alignSelf: "flex-start" }}
        />
      ) : null}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <ActionButton
          projectId={projectId}
          actionPath="docker/up"
          label="Compose up"
          icon={<PlayArrowIcon fontSize="small" />}
          disabled={!canStartCompose}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="docker/rebuild"
          label="Rebuild compose"
          icon={<BuildIcon fontSize="small" />}
          disabled={!canRebuildCompose}
          onResult={onResult}
          onCompleted={onCompleted}
        />
        <ActionButton
          projectId={projectId}
          actionPath="docker/stop"
          label="Stop compose"
          icon={<StopCircleIcon fontSize="small" />}
          disabled={!canStopCompose}
          onResult={onResult}
          onCompleted={onCompleted}
        />
      </Stack>
      <PlaceholderPanel
        title={hasDockerCompose ? "Compose project" : "Docker Compose non rilevato"}
        body={
          hasDockerCompose
            ? "Prossimo step: mostrare servizi, porte, stato running/stopped e log rapidi."
            : "Questo repository non espone file compose.yml o docker-compose.yml."
        }
      />
    </Stack>
  );
}

type GitActivityGraphProps = {
  commits: GitActivityCommit[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

function GitActivityGraph({
  commits,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore
}: GitActivityGraphProps) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const maybeLoadMore = React.useCallback(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement || !hasMore || isLoadingMore) {
      return;
    }

    const distanceFromBottom = scrollElement.scrollHeight - scrollElement.scrollTop - scrollElement.clientHeight;

    if (distanceFromBottom < 80) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  React.useEffect(() => {
    maybeLoadMore();
  }, [commits.length, maybeLoadMore]);

  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight: 220,
        flexGrow: 1,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden"
      }}
    >
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0 }}>
        Graph
      </Typography>
      <Stack
        sx={{
          p: 1.25,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 0.5,
          bgcolor: "background.paper",
          minWidth: 0,
          height: "100%",
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        <Box
          ref={scrollRef}
          onScroll={maybeLoadMore}
          sx={{
            minWidth: 0,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            pr: 0.5,
            overscrollBehavior: "contain",
            scrollbarWidth: "thin"
          }}
        >
          {isLoading ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary", height: "100%" }}>
              <CircularProgress size={16} />
              <Typography variant="caption">Caricamento graph</Typography>
            </Stack>
          ) : commits.length > 0 ? (
            <>
              {commits.map((commit, index) => (
                <GitActivityRow
                  key={commit.hash}
                  commit={commit}
                  index={index}
                  isLast={!hasMore && index === commits.length - 1}
                />
              ))}
              {isLoadingMore ? (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1.25, color: "text.secondary" }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption">Carico altri commit</Typography>
                </Stack>
              ) : null}
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              Nessun commit disponibile.
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

type GitActivityRowProps = {
  commit: GitActivityCommit;
  index: number;
  isLast: boolean;
};

function GitActivityRow({ commit, index, isLast }: GitActivityRowProps) {
  const graphColor = getGraphColor(index);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "18px minmax(0, 1fr)",
        columnGap: 0.75,
        minHeight: 34
      }}
    >
      <Box sx={{ position: "relative" }}>
        {!isLast ? (
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              top: 0,
              bottom: -1,
              left: 7,
              width: 2,
              bgcolor: graphColor,
              opacity: 0.65
            }}
          />
        ) : null}
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            top: 6,
            left: 3,
            width: 10,
            height: 10,
            borderRadius: "50%",
            bgcolor: graphColor,
            border: "2px solid",
            borderColor: "background.paper"
          }}
        />
      </Box>
      <Box sx={{ minWidth: 0, pb: 0.85 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ minWidth: 0, fontWeight: 700 }}>
            {commit.message}
          </Typography>
          {commit.refs.slice(0, 2).map((ref) => (
            <Chip
              key={`${commit.hash}-${ref}`}
              size="small"
              label={ref}
              color={getRefColor(ref)}
              sx={{
                height: 20,
                maxWidth: 96,
                flexShrink: 0,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }
              }}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {commit.shortHash} by {commit.author} - {formatDate(commit.date)}
        </Typography>
      </Box>
    </Box>
  );
}

function findDockerGroupForProject(groups: DockerContainerGroup[], project: ProjectSummary): DockerContainerGroup | null {
  const normalizedProjectPath = normalizePath(project.path);

  return (
    groups.find((group) => group.workingDir && normalizePath(group.workingDir) === normalizedProjectPath) ??
    groups.find((group) => group.name.toLowerCase() === project.name.toLowerCase()) ??
    null
  );
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function getGraphColor(index: number): string {
  const colors = ["#4ea1ff", "#bb6bd9", "#ff7a1a", "#2dd4bf"];
  return colors[Math.min(Math.floor(index / 6), colors.length - 1)];
}

function getRefColor(ref: string): "primary" | "secondary" | "warning" | "default" {
  if (ref.startsWith("origin/")) {
    return "secondary";
  }

  if (ref.startsWith("tag:")) {
    return "warning";
  }

  return "primary";
}

function getDockerStatusLabel(isDockerAvailable: boolean, isDockerRunning: boolean): string {
  if (!isDockerAvailable) {
    return "compose unknown";
  }

  return isDockerRunning ? "compose running" : "compose stopped";
}

type PlaceholderPanelProps = {
  title: string;
  body: string;
};

function PlaceholderPanel({ title, body }: PlaceholderPanelProps) {
  return (
    <Box
      sx={{
        minHeight: 220,
        p: 2,
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1,
        display: "grid",
        alignContent: "center",
        gap: 0.5
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {body}
      </Typography>
    </Box>
  );
}
