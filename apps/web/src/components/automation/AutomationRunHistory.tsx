import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Box, ButtonBase, Chip, CircularProgress, Divider, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { WorkflowRun } from "../../types/workflows";
import {
  getWorkflowRunStatusColor,
  getWorkflowRunStatusLabelKey,
  isActiveWorkflowRunStatus
} from "./workflowRunStatus";

type AutomationRunHistoryProps = {
  runs: WorkflowRun[];
  onSelectRun: (run: WorkflowRun) => void;
};

export function AutomationRunHistory({ runs, onSelectRun }: AutomationRunHistoryProps) {
  const { t, i18n } = useTranslation();

  return (
    <Box
      component="section"
      aria-labelledby="automation-runs-title"
      sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Box>
          <Typography id="automation-runs-title" variant="subtitle2" fontWeight={500}>
            {t("automation.runsTitle")}
          </Typography>
          <Typography variant="caption" color="text.secondary">{t("automation.runsSubtitle")}</Typography>
        </Box>
        <Chip size="small" variant="outlined" label={runs.length} />
      </Stack>
      <Divider />
      {runs.length === 0 ? (
        <Box sx={{ minHeight: 84, display: "grid", placeItems: "center", px: 2 }}>
          <Typography variant="body2" color="text.secondary">{t("automation.noRuns")}</Typography>
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
              <RunStatusIcon run={run} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {isActiveWorkflowRunStatus(run.status)
                    ? t("automation.runInProgress")
                    : formatRunDate(run.completedAt, i18n.language)}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" noWrap>
                  {t("automation.runSummary", {
                    repositories: run.summary.selectedProjects,
                    commands: run.summary.commands
                  })}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                label={run.mode === "dry-run" ? t("automation.previewChip") : t("automation.runChip")}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                {run.durationMs} ms
              </Typography>
              <Chip
                size="small"
                color={getWorkflowRunStatusColor(run.status)}
                label={t(`automation.runStatus.${getWorkflowRunStatusLabelKey(run.status)}`)}
                sx={{ display: { xs: "none", sm: "flex" } }}
              />
            </ButtonBase>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function RunStatusIcon({ run }: { run: WorkflowRun }) {
  if (isActiveWorkflowRunStatus(run.status)) return <CircularProgress size={16} />;
  if (run.status === "failed") return <ErrorOutlineIcon color="error" fontSize="small" />;
  if (run.status === "warning") return <WarningAmberOutlinedIcon color="warning" fontSize="small" />;
  if (run.status === "cancelled" || run.status === "interrupted") {
    return <CancelOutlinedIcon color="disabled" fontSize="small" />;
  }
  return <CheckCircleOutlineIcon color="success" fontSize="small" />;
}

function formatRunDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
