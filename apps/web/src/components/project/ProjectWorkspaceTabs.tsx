import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { alpha, Box, ButtonBase, IconButton, Tooltip, Typography } from "@mui/material";
import React, { type KeyboardEvent } from "react";
import type { ProjectSummary } from "../../types/projects";
import { getProjectPanelId, getProjectTabId } from "./projectWorkspaceIds";

type ProjectWorkspaceTabsProps = {
  projects: ProjectSummary[];
  activeProjectId: string | null;
  onActiveProjectChange: (projectId: string) => void;
  onCloseProject: (projectId: string) => void;
};

export const ProjectWorkspaceTabs = React.memo(function ProjectWorkspaceTabs({
  projects,
  activeProjectId,
  onActiveProjectChange,
  onCloseProject
}: ProjectWorkspaceTabsProps) {
  if (projects.length === 0) {
    return null;
  }

  function focusProjectTab(projectId: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(getProjectTabId(projectId))?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, projectIndex: number) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (projectIndex + 1) % projects.length;
    if (event.key === "ArrowLeft") nextIndex = (projectIndex - 1 + projects.length) % projects.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = projects.length - 1;

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextProject = projects[nextIndex];
    onActiveProjectChange(nextProject.id);
    focusProjectTab(nextProject.id);
  }

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper"
      }}
    >
      <Box
        role="tablist"
        aria-label="Repository aperti"
        sx={{
          width: "100%",
          maxWidth: 1680,
          mx: "auto",
          px: { xs: 0.75, sm: 1.75, lg: 2.25 },
          display: "flex",
          alignItems: "stretch",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "thin",
          overscrollBehaviorX: "contain"
        }}
      >
        {projects.map((project, projectIndex) => {
          const isActive = project.id === activeProjectId;

          return (
            <Box
              component="span"
              role="presentation"
              key={project.id}
              sx={{
                position: "relative",
                minWidth: { xs: 180, sm: 220 },
                maxWidth: 260,
                flex: "0 1 240px",
                borderRight: "1px solid",
                borderColor: "divider",
                "&:first-of-type": {
                  borderLeft: "1px solid",
                  borderLeftColor: "divider"
                }
              }}
            >
              <ButtonBase
                id={getProjectTabId(project.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={getProjectPanelId(project.id)}
                tabIndex={isActive || (!activeProjectId && projectIndex === 0) ? 0 : -1}
                onClick={() => onActiveProjectChange(project.id)}
                onKeyDown={(event) => handleTabKeyDown(event, projectIndex)}
                sx={(theme) => ({
                  position: "relative",
                  width: "100%",
                  height: 42,
                  minWidth: 0,
                  justifyContent: "flex-start",
                  gap: 1,
                  pl: 1.25,
                  pr: 4.75,
                  textAlign: "left",
                  color: isActive ? "text.primary" : "text.secondary",
                  bgcolor: isActive ? alpha(theme.palette.primary.main, 0.075) : "transparent",
                  transition: "background-color 160ms ease, color 160ms ease",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: "auto 0 0",
                    height: 2,
                    bgcolor: "primary.main",
                    transform: isActive ? "scaleX(1)" : "scaleX(0)",
                    transformOrigin: "center",
                    transition: "transform 160ms ease"
                  },
                  "&:hover": {
                    color: "text.primary",
                    bgcolor: isActive ? alpha(theme.palette.primary.main, 0.1) : "action.hover"
                  },
                  "&:focus-visible": {
                    zIndex: 1,
                    outline: `3px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                    outlineOffset: -3
                  }
                })}
              >
                <AccountTreeOutlinedIcon
                  sx={{
                    flexShrink: 0,
                    fontSize: 18,
                    color: isActive ? "primary.main" : "text.secondary"
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                    {project.name}
                  </Typography>
                  <Typography variant="caption" noWrap component="div" color="text.secondary">
                    {project.branch}
                  </Typography>
                </Box>
                {!project.isClean ? (
                  <WarningAmberRoundedIcon
                    aria-label="Repository con modifiche locali"
                    sx={{ ml: "auto", flexShrink: 0, fontSize: 15, color: "warning.main" }}
                  />
                ) : null}
              </ButtonBase>

              <Tooltip title={`Chiudi ${project.name}`}>
                <IconButton
                  size="small"
                  aria-label={`Chiudi ${project.name}`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    const fallbackProject = projects[projectIndex + 1] ?? projects[projectIndex - 1] ?? null;
                    onCloseProject(project.id);

                    if (fallbackProject) {
                      focusProjectTab(fallbackProject.id);
                    }
                  }}
                  sx={{
                    position: "absolute",
                    zIndex: 2,
                    top: 7,
                    right: 7,
                    width: 28,
                    height: 28,
                    color: "text.secondary",
                    "&:hover": { color: "text.primary", bgcolor: "action.hover" }
                  }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});
