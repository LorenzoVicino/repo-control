import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { alpha, Box, ButtonBase, Paper, Stack, Typography } from "@mui/material";
import type { DashboardSnapshot } from "./dashboardInsights";

type DashboardInsightsProps = {
  snapshot: DashboardSnapshot;
  onOpenProject: (projectId: string) => void;
};

const STATUS_SERIES = [
  { key: "healthy", label: "Pronti", color: "#059669" },
  { key: "dirty", label: "Modificati", color: "#d97706" },
  { key: "behind", label: "Da aggiornare", color: "#e11d48" },
  { key: "ahead", label: "Ahead", color: "#0284c7" }
] as const;

export function DashboardInsights({ snapshot, onOpenProject }: DashboardInsightsProps) {
  const maxChangeLoad = Math.max(1, ...snapshot.changeLoad.map((entry) => entry.total));

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(300px, 0.78fr) minmax(420px, 1.22fr)" },
        gap: { xs: 1.5, md: 2 }
      }}
    >
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="workspace-health-title"
        sx={{
          p: { xs: 1.75, sm: 2 },
          minWidth: 0,
          bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.96 : 0.9)
        }}
      >
        <Typography id="workspace-health-title" component="h2" variant="h2">
          Salute del workspace
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Stato operativo dei repository rilevati
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "112px minmax(0, 1fr)", sm: "126px minmax(0, 1fr)" },
            gap: { xs: 2, sm: 2.5 },
            alignItems: "center",
            mt: 2.25
          }}
        >
          <Box
            role="img"
            aria-label={`${snapshot.healthPercentage}% dei repository pronti al lavoro`}
            sx={{
              width: { xs: 112, sm: 126 },
              height: { xs: 112, sm: 126 },
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: (theme) => `conic-gradient(${theme.palette.success.main} 0 ${snapshot.healthPercentage}%, ${alpha(theme.palette.warning.main, 0.3)} ${snapshot.healthPercentage}% 100%)`
            }}
          >
            <Box
              sx={{
                width: { xs: 82, sm: 92 },
                height: { xs: 82, sm: 92 },
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                bgcolor: "background.paper"
              }}
            >
              <Box>
                <Typography sx={{ fontSize: "1.55rem", fontWeight: 800, lineHeight: 1 }}>
                  {snapshot.healthPercentage}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  pronti
                </Typography>
              </Box>
            </Box>
          </Box>

          <Stack spacing={1.2}>
            {STATUS_SERIES.map((status) => {
              const value = snapshot[status.key];
              const width = snapshot.total === 0 ? 0 : Math.max(value > 0 ? 6 : 0, (value / snapshot.total) * 100);

              return (
                <Box key={status.key}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      {status.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 750 }}>
                      {value}
                    </Typography>
                  </Stack>
                  <Box sx={{ height: 5, mt: 0.45, bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.12), overflow: "hidden" }}>
                    <Box sx={{ width: `${width}%`, height: "100%", bgcolor: status.color }} />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Paper>

      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="change-load-title"
        sx={{
          p: { xs: 1.75, sm: 2 },
          minWidth: 0,
          bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.96 : 0.9)
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
          <Box>
            <Typography id="change-load-title" component="h2" variant="h2">
              Carico delle modifiche
            </Typography>
            <Typography variant="caption" color="text.secondary">
              File locali interessati, per repository
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" aria-label="Legenda modifiche">
            <Legend color="#2563eb" label="Staged" />
            <Legend color="#d97706" label="Modificati" />
            <Legend color="#e11d48" label="Nuovi" />
          </Stack>
        </Stack>

        {snapshot.changeLoad.length === 0 ? (
          <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 188, color: "success.main" }}>
            <CheckCircleOutlineRoundedIcon />
            <Typography variant="body2" color="text.secondary">
              Nessuna modifica locale da gestire
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={0.35} sx={{ mt: 1.5 }}>
            {snapshot.changeLoad.map(({ project, total }) => {
              const stagedWidth = (project.staged / maxChangeLoad) * 100;
              const modifiedWidth = (project.modified / maxChangeLoad) * 100;
              const untrackedWidth = (project.untracked / maxChangeLoad) * 100;

              return (
                <ButtonBase
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  aria-label={`Apri ${project.name}, ${total} file modificati`}
                  sx={(theme) => ({
                    width: "100%",
                    minWidth: 0,
                    display: "grid",
                    gridTemplateColumns: { xs: "minmax(90px, 0.8fr) minmax(110px, 1.2fr) 28px", sm: "minmax(130px, 0.75fr) minmax(180px, 1.25fr) 28px" },
                    gap: 1.25,
                    alignItems: "center",
                    px: 0.75,
                    py: 0.8,
                    textAlign: "left",
                    borderRadius: 1,
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.05 : 0.1) },
                    "&:focus-visible": { outline: `3px solid ${alpha(theme.palette.primary.main, 0.24)}`, outlineOffset: -2 }
                  })}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
                      {project.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>
                      {project.branch || "branch non rilevata"}
                    </Typography>
                  </Box>

                  <Box sx={{ height: 8, display: "flex", bgcolor: (theme) => alpha(theme.palette.text.secondary, 0.11), overflow: "hidden" }}>
                    <Box sx={{ width: `${stagedWidth}%`, bgcolor: "#2563eb" }} />
                    <Box sx={{ width: `${modifiedWidth}%`, bgcolor: "#d97706" }} />
                    <Box sx={{ width: `${untrackedWidth}%`, bgcolor: "#e11d48" }} />
                  </Box>

                  <Stack direction="row" spacing={0.25} alignItems="center" justifyContent="flex-end">
                    <Typography variant="caption" sx={{ fontWeight: 750 }}>
                      {total}
                    </Typography>
                    <OpenInNewRoundedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
                  </Stack>
                </ButtonBase>
              );
            })}
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 7, height: 7, bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
