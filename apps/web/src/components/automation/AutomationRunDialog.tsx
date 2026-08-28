import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import SkipNextOutlinedIcon from "@mui/icons-material/SkipNextOutlined";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { WorkflowRun, WorkflowRunStep } from "../../types/workflows";
import {
  getWorkflowRunStatusColor,
  getWorkflowRunStatusLabelKey,
  isActiveWorkflowRunStatus
} from "./workflowRunStatus";

type AutomationRunDialogProps = {
  run: WorkflowRun | null;
  onClose: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
};

export function AutomationRunDialog({ run, onClose, onCancel, cancelling = false }: AutomationRunDialogProps) {
  const { t } = useTranslation();
  const isActive = Boolean(run && isActiveWorkflowRunStatus(run.status));

  return (
    <Dialog open={Boolean(run)} onClose={onClose} fullWidth maxWidth="md">
      {run ? (
        <>
          <DialogTitle>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography component="span" variant="h3" sx={{ flexGrow: 1 }}>{run.workflowName}</Typography>
              <Chip
                size="small"
                variant="outlined"
                label={run.mode === "dry-run" ? t("automation.previewChip") : t("automation.run.executionChip")}
              />
              <Chip
                size="small"
                icon={isActive ? <CircularProgress size={12} color="inherit" /> : undefined}
                color={getWorkflowRunStatusColor(run.status)}
                label={t(`automation.runStatus.${getWorkflowRunStatusLabelKey(run.status)}`)}
              />
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            {run.status === "failed" ? (
              <Alert severity="error" sx={{ mb: 2 }}>{t("automation.run.failedAlert")}</Alert>
            ) : run.status === "warning" ? (
              <Alert severity="warning" sx={{ mb: 2 }}>{t("automation.run.warningAlert")}</Alert>
            ) : run.status === "cancelled" || run.status === "interrupted" ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {run.statusMessage ?? t("automation.run.irregularAlert")}
              </Alert>
            ) : isActive ? (
              <Alert severity="info" sx={{ mb: 2 }}>{t("automation.run.activeAlert")}</Alert>
            ) : null}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip
                size="small"
                label={t("automation.run.repositoriesChip", { total: run.summary.selectedProjects })}
              />
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={t("automation.run.succeededChip", { total: run.summary.succeeded })}
              />
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={t("automation.run.skippedChip", { total: run.summary.skipped })}
              />
              <Chip
                size="small"
                color="error"
                variant="outlined"
                label={t("automation.run.failedChip", { total: run.summary.failed })}
              />
              <Chip size="small" variant="outlined" label={`${run.durationMs} ms`} />
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            {run.steps.map((step) => (
              <Accordion key={step.id} disableGutters variant="outlined" sx={{ "&:not(:last-child)": { borderBottom: 0 } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
                    <StepStatusIcon step={step} />
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={500} noWrap>{step.nodeName}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {step.projectName ?? step.message}
                      </Typography>
                    </Box>
                    <Chip size="small" variant="outlined" label={getStepStatusLabel(t, step)} />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">{step.message}</Typography>
                    {step.command ? <CodeBlock>{step.command}</CodeBlock> : null}
                    {step.stdout ? <CodeBlock>{step.stdout}</CodeBlock> : null}
                    {step.stderr ? <CodeBlock error>{step.stderr}</CodeBlock> : null}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </DialogContent>
          <DialogActions>
            {isActive && onCancel ? (
              <Button
                color="error"
                onClick={onCancel}
                disabled={cancelling}
                startIcon={cancelling ? <CircularProgress size={16} color="inherit" /> : <CancelOutlinedIcon />}
              >
                {t("automation.run.cancelRun")}
              </Button>
            ) : null}
            <Button onClick={onClose}>{t("common.close")}</Button>
          </DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}

function StepStatusIcon({ step }: { step: WorkflowRunStep }) {
  if (step.status === "failed") return <ErrorOutlineIcon color="error" fontSize="small" />;
  if (step.status === "skipped") return <SkipNextOutlinedIcon color="warning" fontSize="small" />;
  if (step.status === "cancelled") return <CancelOutlinedIcon color="disabled" fontSize="small" />;
  return <CheckCircleOutlineIcon color="success" fontSize="small" />;
}

function getStepStatusLabel(t: TFunction, step: WorkflowRunStep): string {
  if (step.status === "failed") return t("automation.run.stepStatus.failed");
  if (step.status === "skipped") return t("automation.run.stepStatus.skipped");
  if (step.status === "cancelled") return t("automation.run.stepStatus.cancelled");
  return t("automation.run.stepStatus.succeeded");
}

function CodeBlock({ children, error = false }: { children: string; error?: boolean }) {
  return (
    <Typography
      component="pre"
      variant="caption"
      color={error ? "error" : "text.primary"}
      sx={{
        m: 0,
        p: 1.25,
        maxHeight: 220,
        overflow: "auto",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        borderRadius: 1,
        bgcolor: "action.hover",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
      }}
    >
      {children}
    </Typography>
  );
}
