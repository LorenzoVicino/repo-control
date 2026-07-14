import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Box, ButtonBase, Chip, Divider, Stack, Typography } from "@mui/material";
import type { WorkflowRun } from "../../types/workflows";

type AutomationRunHistoryProps = {
  runs: WorkflowRun[];
  onSelectRun: (run: WorkflowRun) => void;
};

export function AutomationRunHistory({ runs, onSelectRun }: AutomationRunHistoryProps) {
  return (
    <Box
      component="section"
      aria-labelledby="automation-runs-title"
      sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Box>
          <Typography id="automation-runs-title" variant="subtitle2" fontWeight={800}>Esecuzioni</Typography>
          <Typography variant="caption" color="text.secondary">Cronologia del workflow selezionato</Typography>
        </Box>
        <Chip size="small" variant="outlined" label={runs.length} />
      </Stack>
      <Divider />
      {runs.length === 0 ? (
        <Box sx={{ minHeight: 84, display: "grid", placeItems: "center", px: 2 }}>
          <Typography variant="body2" color="text.secondary">Nessuna esecuzione registrata</Typography>
        </Box>
      ) : (
        <Stack divider={<Divider flexItem />}>
          {runs.slice(0, 10).map((run) => (
            <ButtonBase
              key={run.id}
              onClick={() => onSelectRun(run)}
              sx={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: { xs: "26px minmax(0, 1fr) auto", sm: "26px minmax(0, 1fr) auto auto auto" },
                gap: 1.25,
                alignItems: "center",
                px: 1.5,
                py: 1.1,
                textAlign: "left",
                "&:hover": { bgcolor: "action.hover" }
              }}
            >
              {run.status === "success" ? (
                <CheckCircleOutlineIcon color="success" fontSize="small" />
              ) : (
                <ErrorOutlineIcon color="error" fontSize="small" />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>{formatRunDate(run.completedAt)}</Typography>
                <Typography variant="caption" color="text.secondary" component="div" noWrap>
                  {run.summary.selectedProjects} repository · {run.summary.commands} comandi
                </Typography>
              </Box>
              <Chip size="small" variant="outlined" label={run.mode === "dry-run" ? "Anteprima" : "Run"} />
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                {run.durationMs} ms
              </Typography>
              <Chip
                size="small"
                color={run.status === "success" ? "success" : "error"}
                label={run.status === "success" ? "Riuscita" : "Fallita"}
                sx={{ display: { xs: "none", sm: "flex" } }}
              />
            </ButtonBase>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function formatRunDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
