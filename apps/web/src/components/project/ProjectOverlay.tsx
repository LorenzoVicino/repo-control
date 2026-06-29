import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Dialog, DialogContent, Stack, Tab, Tabs, Typography } from "@mui/material";
import React from "react";
import { ProjectDetailPanel } from "./ProjectDetailPanel";
import type { CommandResult, ProjectSummary } from "../../types";

type ProjectOverlayProps = {
  open: boolean;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  onActiveProjectChange: (projectId: string) => void;
  onCloseProject: (projectId: string) => void;
  onCloseOverlay: () => void;
  onRefresh: () => void;
};

export function ProjectOverlay({
  open,
  projects,
  activeProjectId,
  onActiveProjectChange,
  onCloseProject,
  onCloseOverlay,
  onRefresh
}: ProjectOverlayProps) {
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
