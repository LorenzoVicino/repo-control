import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Dialog, DialogContent, Stack, Tab, Tabs, Typography } from "@mui/material";
import { ProjectDetailPanel } from "./ProjectDetailPanel";
import type { ProjectSummary } from "../../types";

type ProjectOverlayProps = {
  open: boolean;
  projects: ProjectSummary[];
  activeProjectId: string | null;
  favoriteProjectIds: string[];
  onActiveProjectChange: (projectId: string) => void;
  onCloseProject: (projectId: string) => void;
  onCloseOverlay: () => void;
  onToggleFavorite: (projectId: string) => void;
  onRefresh: () => void;
};

export function ProjectOverlay({
  open,
  projects,
  activeProjectId,
  favoriteProjectIds,
  onActiveProjectChange,
  onCloseProject,
  onCloseOverlay,
  onToggleFavorite,
  onRefresh
}: ProjectOverlayProps) {
  const activeValue = projects.some((project) => project.id === activeProjectId)
    ? activeProjectId
    : projects[0]?.id ?? false;

  if (projects.length === 0) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onCloseOverlay}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          height: { xs: "100dvh", md: "88dvh" },
          maxHeight: { xs: "100dvh", md: "88dvh" },
          m: { xs: 0, md: 2 },
          overflow: "hidden",
          bgcolor: "background.default"
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0, height: "100%", overflow: "hidden" }}>
        <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Tabs
            value={activeValue}
            onChange={(_, nextProjectId: string) => onActiveProjectChange(nextProjectId)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Open project tabs"
            sx={{
              minHeight: 48,
              "& .MuiTab-root": {
                minHeight: 48,
                alignItems: "flex-start"
              }
            }}
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

        <Box sx={{ minHeight: 0, flex: "1 1 auto", height: "100%", overflow: "hidden" }}>
          {projects.map((project) => (
            <Box key={project.id} hidden={project.id !== activeValue} sx={{ minHeight: "100%", height: "100%" }}>
              <ProjectDetailPanel
                project={project}
                isFavorite={favoriteProjectIds.includes(project.id)}
                onClose={() => onCloseProject(project.id)}
                onToggleFavorite={() => onToggleFavorite(project.id)}
                onResult={() => undefined}
                onRefresh={onRefresh}
              />
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
