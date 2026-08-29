import AccountTreeIcon from "@mui/icons-material/AccountTree";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import { alpha, Box, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { StatusChips } from "../shared/StatusChips";
import { SyncChips } from "../shared/SyncChips";
import type { ProjectSummary } from "../../types/projects";

const EMPTY_PROJECT_IDS: string[] = [];

type ProjectTableProps = {
  projects: ProjectSummary[];
  openProjectIds?: string[];
  density?: "compact" | "comfortable";
  onSelectProject: (projectId: string) => void;
};

export const ProjectTable = React.memo(function ProjectTable({ projects, openProjectIds = EMPTY_PROJECT_IDS, density = "compact", onSelectProject }: ProjectTableProps) {
  const { t } = useTranslation();
  const openProjectIdSet = React.useMemo(() => new Set(openProjectIds), [openProjectIds]);
  if (projects.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6">{t("dashboard.table.noRepositories")}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("dashboard.table.refineSearch")}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: "calc(100dvh - 220px)" }}>
      <Table size={density === "compact" ? "small" : "medium"} stickyHeader sx={{ minWidth: 1040 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t("dashboard.table.repository")}</TableCell>
            <TableCell>{t("dashboard.table.branch")}</TableCell>
            <TableCell>{t("dashboard.table.state")}</TableCell>
            <TableCell>{t("dashboard.table.sync")}</TableCell>
            <TableCell>{t("dashboard.table.lastCommit")}</TableCell>
            <TableCell>{t("dashboard.table.path")}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {projects.map((project) => (
            <TableRow
              key={project.id}
              hover
              tabIndex={0}
              onClick={() => onSelectProject(project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectProject(project.id);
                }
              }}
              sx={{
                cursor: "pointer",
                bgcolor: openProjectIdSet.has(project.id) ? (theme) => alpha(theme.palette.primary.main, 0.045) : "transparent",
                "& > td:first-of-type": {
                  borderLeft: "2px solid",
                  borderLeftColor: openProjectIdSet.has(project.id) ? "primary.main" : "transparent"
                },
                "&:focus-visible": {
                  outline: "3px solid",
                  outlineColor: (theme) => alpha(theme.palette.primary.main, 0.25),
                  outlineOffset: -3
                }
              }}
            >
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 170 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      borderRadius: 1,
                      color: project.isClean ? "success.main" : "warning.main",
                      bgcolor: (theme) =>
                        alpha(project.isClean ? theme.palette.success.main : theme.palette.warning.main, 0.1)
                    }}
                  >
                    <AccountTreeIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                    {project.name}
                  </Typography>
                  {openProjectIdSet.has(project.id) ? <Chip size="small" color="primary" variant="outlined" label={t("dashboard.table.open")} /> : null}
                </Stack>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <CallSplitIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                  <Typography variant="body2" noWrap>
                    {project.branch}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>
                <StatusChips project={project} />
              </TableCell>
              <TableCell>
                <SyncChips project={project} />
              </TableCell>
              <TableCell sx={{ maxWidth: 320 }}>
                {project.lastCommit ? (
                  <Box>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {project.lastCommit.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {project.lastCommit.hash} · {project.lastCommit.author}
                    </Typography>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.table.noCommit")}
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ color: "text.secondary", maxWidth: 360 }} title={project.path}>
                <Typography
                  variant="caption"
                  noWrap
                  component="div"
                  sx={{ fontFamily: "var(--rc-font-mono)" }}
                >
                  {project.path}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
});
