import BuildIcon from "@mui/icons-material/Build";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { Box, Chip, Divider, IconButton, Paper, Stack, Tab, Tabs, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { fetchGitDetails } from "../../api/client";
import { ActionButton } from "../shared/ActionButton";
import { CommandOutput } from "../shared/CommandOutput";
import { DetailBlock } from "../shared/DetailBlock";
import { StatusChips } from "../shared/StatusChips";
import { SyncChips } from "../shared/SyncChips";
import { BranchesPanel } from "./BranchesPanel";
import { ChangesPanel } from "./ChangesPanel";
import { TerminalPanel } from "./TerminalPanel";
import type { CommandResult, ProjectDetailTab, ProjectSummary } from "../../types";
import { formatDate } from "../../utils/projects";

type ProjectDetailPanelProps = {
  project: ProjectSummary;
  result: CommandResult | null;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  onResult: (result: CommandResult) => void;
  onRefresh: () => void;
};

export function ProjectDetailPanel({
  project,
  result,
  isFavorite,
  onClose,
  onToggleFavorite,
  onResult,
  onRefresh
}: ProjectDetailPanelProps) {
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
