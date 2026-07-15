import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CommitRoundedIcon from "@mui/icons-material/CommitRounded";
import { alpha, Box, Button, ButtonBase, Paper, Stack, Typography } from "@mui/material";
import { formatDate } from "../../utils/projects";
import type { DashboardSnapshot } from "./dashboardInsights";
import type { DashboardSection } from "./DashboardSidebar";

type DashboardRecentActivityProps = {
  snapshot: DashboardSnapshot;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject: (projectId: string) => void;
};

export function DashboardRecentActivity({ snapshot, onNavigate, onOpenProject }: DashboardRecentActivityProps) {
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="recent-activity-title"
      sx={{
        minWidth: 0,
        overflow: "hidden",
        bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.96 : 0.9)
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: { xs: 1.75, sm: 2 }, py: 1.5 }}>
        <Box>
          <Typography id="recent-activity-title" component="h2" variant="h2">
            Attività recente
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ultimi commit nel workspace
          </Typography>
        </Box>
        <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onNavigate("repositories")}>
          Tutti
        </Button>
      </Stack>

      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", borderTop: "1px solid", borderColor: "divider" }}>
        {snapshot.recentProjects.map((project) => (
          <Box component="li" key={project.id} sx={{ borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}>
            <ButtonBase
              onClick={() => onOpenProject(project.id)}
              aria-label={`Apri ${project.name}: ${project.lastCommit?.message ?? "ultimo commit"}`}
              sx={(theme) => ({
                width: "100%",
                minWidth: 0,
                display: "grid",
                gridTemplateColumns: "28px minmax(0, 1fr) auto",
                gap: 1.25,
                alignItems: "center",
                px: { xs: 1.75, sm: 2 },
                py: 1.15,
                textAlign: "left",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.05 : 0.1) },
                "&:focus-visible": { outline: `3px solid ${alpha(theme.palette.primary.main, 0.24)}`, outlineOffset: -3 }
              })}
            >
              <Box sx={{ display: "grid", placeItems: "center", color: project.isClean ? "success.main" : "warning.main" }}>
                <CommitRoundedIcon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="baseline" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 750, flexShrink: 0, maxWidth: "42%" }}>
                    {project.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {project.lastCommit?.message}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.15 }}>
                  {project.lastCommit?.author} · {project.lastCommit ? formatDate(project.lastCommit.date) : ""}
                </Typography>
              </Box>
              <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />
            </ButtonBase>
          </Box>
        ))}
      </Box>

      {snapshot.recentProjects.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 4, textAlign: "center" }}>
          Nessun commit recente disponibile
        </Typography>
      ) : null}
    </Paper>
  );
}
