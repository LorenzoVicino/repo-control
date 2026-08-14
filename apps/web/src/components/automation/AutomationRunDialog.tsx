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
import type { WorkflowRun, WorkflowRunStep } from "../../types/workflows";
import {
  getWorkflowRunStatusColor,
  getWorkflowRunStatusLabel,
  isActiveWorkflowRunStatus
} from "./workflowRunStatus";

type AutomationRunDialogProps = {
  run: WorkflowRun | null;
  onClose: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
};

export function AutomationRunDialog({ run, onClose, onCancel, cancelling = false }: AutomationRunDialogProps) {
  const isActive = Boolean(run && isActiveWorkflowRunStatus(run.status));

  return (
    <Dialog open={Boolean(run)} onClose={onClose} fullWidth maxWidth="md">
      {run ? (
        <>
          <DialogTitle>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <Typography component="span" variant="h3" sx={{ flexGrow: 1 }}>{run.workflowName}</Typography>
              <Chip size="small" variant="outlined" label={run.mode === "dry-run" ? "Anteprima" : "Esecuzione"} />
              <Chip
                size="small"
                icon={isActive ? <CircularProgress size={12} color="inherit" /> : undefined}
                color={getWorkflowRunStatusColor(run.status)}
                label={getWorkflowRunStatusLabel(run.status)}
              />
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            {run.status === "failed" ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                L'esecuzione si è fermata al primo step fallito. Apri il dettaglio per correggere il problema.
              </Alert>
            ) : run.status === "warning" ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                L'esecuzione è terminata, ma uno o più comandi sono stati saltati.
              </Alert>
            ) : run.status === "cancelled" || run.status === "interrupted" ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {run.statusMessage ?? "L'esecuzione non è terminata regolarmente."}
              </Alert>
            ) : isActive ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                L'esecuzione è in corso in background: puoi chiudere questa finestra, il progresso continua e resta
                visibile nello storico.
              </Alert>
            ) : null}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
              <Chip size="small" label={`${run.summary.selectedProjects} repository`} />
              <Chip size="small" color="success" variant="outlined" label={`${run.summary.succeeded} riusciti`} />
              <Chip size="small" color="warning" variant="outlined" label={`${run.summary.skipped} saltati`} />
              <Chip size="small" color="error" variant="outlined" label={`${run.summary.failed} falliti`} />
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
                    <Chip size="small" variant="outlined" label={stepStatusLabel(step)} />
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
                Annulla esecuzione
              </Button>
            ) : null}
            <Button onClick={onClose}>Chiudi</Button>
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

function stepStatusLabel(step: WorkflowRunStep): string {
  if (step.status === "failed") return "Fallito";
  if (step.status === "skipped") return "Saltato";
  if (step.status === "cancelled") return "Annullato";
  return "Riuscito";
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
