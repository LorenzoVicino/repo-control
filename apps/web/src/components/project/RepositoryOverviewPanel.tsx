import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import CommitOutlinedIcon from "@mui/icons-material/CommitOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import { alpha, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import type { CommandResult } from "../../types/common";
import type { DockerComposeProjectResponse } from "../../types/docker";
import type { GitActivityCommit, GitDetails } from "../../types/git";
import type { ProjectSummary } from "../../types/projects";
import { formatDate } from "../../utils/projects";
import { ActionButton } from "../shared/ActionButton";

type RepositoryOverviewPanelProps = {
  project: ProjectSummary;
  details: GitDetails | undefined;
  commits: GitActivityCommit[];
  dockerProject: DockerComposeProjectResponse | undefined;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onResult: (result: CommandResult) => void;
  onCompleted: () => void;
};

export function RepositoryOverviewPanel({
  project,
  details,
  commits,
  dockerProject,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onResult,
  onCompleted
}: RepositoryOverviewPanelProps) {
  const { t, i18n } = useTranslation();
  const staged = details?.status.files.staged.length ?? project.staged;
  const unstaged = details?.status.files.unstaged.length ?? project.modified + project.untracked;
  const conflicts = details?.status.files.unstaged.filter((file) => file.status === "conflicted").length ?? 0;
  const runningServices = dockerProject?.services.filter((service) => service.state.toLowerCase() === "running").length ?? 0;
  const unhealthyServices = dockerProject?.services.filter((service) => service.health === "unhealthy").length ?? 0;
  const totalServices = dockerProject?.services.length ?? 0;
  const attentionItems = getAttentionItems(t, project, details, conflicts, unhealthyServices);
  const canStartDocker = project.hasDockerCompose && dockerProject?.ok === true && runningServices === 0;
  const canStopDocker = project.hasDockerCompose && dockerProject?.ok === true && runningServices > 0;

  return (
    <Stack spacing={2}>
      {attentionItems.length > 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderColor: (theme) => alpha(theme.palette.warning.main, 0.45),
            bgcolor: (theme) => alpha(theme.palette.warning.main, 0.055)
          }}
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <ErrorOutlineIcon color="warning" fontSize="small" sx={{ mt: 0.15 }} />
            <Box>
              <Typography variant="subtitle1">{t("project.overview.attentionTitle")}</Typography>
              <Stack component="ul" spacing={0.35} sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                {attentionItems.map((item) => (
                  <Typography key={item} component="li" variant="body2" color="text.secondary">
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleOutlineIcon color="success" fontSize="small" />
            <Box>
              <Typography variant="subtitle1">{t("project.overview.healthyTitle")}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t("project.overview.healthyDescription")}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
          gap: 1.25
        }}
      >
        <OverviewMetric
          icon={<CodeOutlinedIcon />}
          label={t("project.overview.workingTree")}
          value={staged + unstaged === 0
            ? t("project.overview.clean")
            : t("project.overview.changesCount", { total: staged + unstaged })}
          detail={t("project.overview.stagedUnstaged", { staged, unstaged })}
          tone={staged + unstaged === 0 ? "success" : "warning"}
        />
        <OverviewMetric
          icon={<CloudDownloadOutlinedIcon />}
          label={t("project.overview.sync")}
          value={details?.status.tracking ?? t("project.overview.noUpstream")}
          detail={t("project.overview.aheadBehind", {
            ahead: details?.status.ahead ?? project.ahead,
            behind: details?.status.behind ?? project.behind
          })}
          tone={(details?.status.behind ?? project.behind) > 0 ? "warning" : "primary"}
        />
        <OverviewMetric
          icon={<Inventory2OutlinedIcon />}
          label={t("project.overview.docker")}
          value={!project.hasDockerCompose
            ? t("project.overview.dockerNotDetected")
            : t("project.overview.dockerRunning", { running: runningServices, total: totalServices || "–" })}
          detail={unhealthyServices > 0
            ? t("project.overview.unhealthyCount", { total: unhealthyServices })
            : dockerProject?.error ?? t("project.overview.localServiceState")}
          tone={unhealthyServices > 0 ? "error" : runningServices > 0 ? "success" : "primary"}
        />
        <OverviewMetric
          icon={<CommitOutlinedIcon />}
          label={t("project.overview.lastCommit")}
          value={project.lastCommit?.message ?? t("project.overview.noCommit")}
          detail={project.lastCommit
            ? `${project.lastCommit.hash} · ${formatDate(project.lastCommit.date, i18n.language)}`
            : t("project.overview.emptyHistory")}
          tone="primary"
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: 1.5 }}>
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1.15, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1">{t("project.overview.recentActivity")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t("project.overview.recentActivitySubtitle")}
              </Typography>
            </Box>
            {isLoading ? <CircularProgress size={17} /> : null}
          </Stack>
          <Stack sx={{ minHeight: 180 }}>
            {commits.length > 0 ? commits.map((commit, index) => (
              <RecentCommitRow key={commit.hash} commit={commit} isLast={index === commits.length - 1 && !hasMore} />
            )) : !isLoading ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
                {t("project.overview.noCommits")}
              </Typography>
            ) : null}
          </Stack>
          {hasMore ? (
            <Button fullWidth onClick={onLoadMore} disabled={isLoadingMore} sx={{ borderTop: "1px solid", borderColor: "divider", borderRadius: 0 }}>
              {isLoadingMore ? t("project.overview.loadingMore") : t("project.overview.showMoreCommits")}
            </Button>
          ) : null}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, alignSelf: "start" }}>
          <Typography variant="subtitle1">{t("project.overview.quickActions")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("project.overview.quickActionsSubtitle")}
          </Typography>
          <Stack spacing={0.85} sx={{ mt: 1.25 }}>
            <ActionButton
              projectId={project.id}
              actionPath="open-vscode"
              label={t("project.overview.openInVSCode")}
              icon={<OpenInNewIcon fontSize="small" />}
              variant="contained"
              fullWidth
              onResult={onResult}
            />
            {canStartDocker ? (
              <ActionButton
                projectId={project.id}
                actionPath="docker/up"
                label={t("project.docker.startStack")}
                icon={<PlayArrowIcon fontSize="small" />}
                fullWidth
                onResult={onResult}
                onCompleted={onCompleted}
              />
            ) : null}
            {canStopDocker ? (
              <ActionButton
                projectId={project.id}
                actionPath="docker/stop"
                label={t("project.docker.stopStack")}
                icon={<StopCircleOutlinedIcon fontSize="small" />}
                fullWidth
                onResult={onResult}
                onCompleted={onCompleted}
              />
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}

function OverviewMetric({
  icon,
  label,
  value,
  detail,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "success" | "warning" | "error";
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.4, minWidth: 0 }}>
      <Stack direction="row" spacing={1.1} alignItems="flex-start">
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            color: `${tone}.main`,
            bgcolor: (theme) => alpha(theme.palette[tone].main, 0.1),
            "& svg": { fontSize: 18 }
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">{label}</Typography>
          <Typography variant="body2" noWrap title={value} sx={{ fontWeight: 500 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={detail} component="div">{detail}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function RecentCommitRow({ commit, isLast }: { commit: GitActivityCommit; isLast: boolean }) {
  const { i18n } = useTranslation();

  return (
    <Stack
      direction="row"
      spacing={1.1}
      sx={{ px: 1.5, py: 1.1, borderBottom: isLast ? 0 : "1px solid", borderColor: "divider" }}
    >
      <Box sx={{ pt: 0.6 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography variant="body2" noWrap sx={{ fontWeight: 500, flexGrow: 1 }}>{commit.message}</Typography>
          {commit.refs.slice(0, 2).map((ref) => <Chip key={`${commit.hash}-${ref}`} size="small" label={ref} />)}
        </Stack>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {commit.shortHash} · {commit.author} · {formatDate(commit.date, i18n.language)}
        </Typography>
      </Box>
    </Stack>
  );
}

function getAttentionItems(
  t: TFunction,
  project: ProjectSummary,
  details: GitDetails | undefined,
  conflicts: number,
  unhealthyServices: number
): string[] {
  const items: string[] = [];
  const behind = details?.status.behind ?? project.behind;
  const unstaged = details
    ? details.status.files.unstaged.length
    : project.modified + project.untracked;
  const tracking = details ? details.status.tracking : project.upstream;
  if (conflicts > 0) items.push(t("project.overview.attention.conflicts", { total: conflicts }));
  if (behind > 0) items.push(t("project.overview.attention.behind", { total: behind }));
  if (unstaged > 0) items.push(t("project.overview.attention.unstaged", { total: unstaged }));
  if (unhealthyServices > 0) {
    items.push(t("project.overview.attention.unhealthy", { total: unhealthyServices }));
  }
  if (!tracking) items.push(t("project.overview.attention.noUpstream"));
  return items;
}
