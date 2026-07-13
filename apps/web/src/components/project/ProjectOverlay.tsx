import AccountTreeIcon from "@mui/icons-material/AccountTree";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { alpha, Box, Dialog, DialogContent, Stack, Tab, Tabs, Typography } from "@mui/material";
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
          width: { xs: "100%", md: "calc(100% - 24px)" },
          maxWidth: { xs: "100%", md: 1536 },
          height: { xs: "100dvh", md: "92dvh" },
          maxHeight: { xs: "100dvh", md: "92dvh" },
          m: { xs: 0, md: 1.5 },
          overflow: "hidden",
          bgcolor: "background.default",
          borderRadius: { xs: 0, md: 1 }
        }
      }}
    >
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0, height: "100%", overflow: "hidden" }}>
        <Box sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper", px: 1 }}>
          <Tabs
            value={activeValue}
            onChange={(_, nextProjectId: string) => onActiveProjectChange(nextProjectId)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Progetti aperti"
            sx={{
              minHeight: 46,
              "& .MuiTab-root": {
                minHeight: 46,
                alignItems: "flex-start",
                borderRadius: 0.75,
                mx: 0.25,
                "&.Mui-selected": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.07)
                }
              }
            }}
          >
            {projects.map((project) => (
              <Tab
                key={project.id}
                value={project.id}
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ maxWidth: 220 }}>
                    <AccountTreeIcon sx={{ fontSize: 16, color: "primary.main" }} />
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
