import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchBrainContext, runBrainTask } from "../../api/brain";
import type { BrainTask } from "../../types/brain";
import { formatTaskDate, getTaskErrorMessage } from "./taskEngineeringUtils";

type ImplementationPanelProps = {
  projectId: string;
  task: BrainTask;
  onChanged: () => Promise<void>;
};

export function ImplementationPanel({ projectId, task, onChanged }: ImplementationPanelProps) {
  const { t, i18n } = useTranslation();
  const [prompt, setPrompt] = React.useState("");
  const [checksText, setChecksText] = React.useState(
    task.verificationChecks.length > 0 ? task.verificationChecks.join("\n") : "npm run build"
  );
  const [runError, setRunError] = React.useState<string | null>(null);
  const contextQuery = useQuery({
    queryKey: ["brain-context", projectId, task.id, task.updatedAt],
    queryFn: () => fetchBrainContext(projectId, task.id)
  });
  const runMutation = useMutation({
    mutationFn: () => runBrainTask(projectId, task.id, {
      prompt,
      checks: checksText.split("\n").map((check) => check.trim()).filter(Boolean)
    }),
    onSuccess: async () => {
      setRunError(null);
      await onChanged();
    },
    onError: (error) => setRunError(getTaskErrorMessage(error, t("taskEngineering.operationFailed")))
  });
  const latestRun = task.implementation.runs[0];

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        {t("taskEngineering.implementation.checkoutNotice", {
          total: task.contextRepositoryPaths.length + 1
        })}
      </Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(320px, 0.72fr)" }, gap: 2 }}>
        <Stack spacing={2}>
          <TextField
            label={t("taskEngineering.implementation.extraInstruction")}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={3}
            placeholder={t("taskEngineering.implementation.extraInstructionPlaceholder")}
          />
          <TextField
            label={t("taskEngineering.implementation.verificationCommands")}
            value={checksText}
            onChange={(event) => setChecksText(event.target.value)}
            multiline
            minRows={4}
            helperText={t("taskEngineering.implementation.verificationHelp")}
            inputProps={{ style: { fontFamily: "var(--rc-font-mono)" } }}
          />
          {runError ? <Alert severity="error">{runError}</Alert> : null}
          <Button
            variant="contained"
            startIcon={runMutation.isPending ? <CircularProgress color="inherit" size={17} /> : <PlayArrowIcon />}
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !checksText.trim() || task.status !== "implementation"}
            sx={{ alignSelf: "flex-start" }}
          >
            {runMutation.isPending
              ? t("taskEngineering.implementation.running")
              : t("taskEngineering.implementation.startIteration")}
          </Button>
        </Stack>

        <Accordion
          variant="outlined"
          disableGutters
          sx={{ minWidth: 0, alignSelf: "start", bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025), "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AutoAwesomeOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {t("taskEngineering.implementation.contextPack")}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={t("taskEngineering.implementation.repoChip", {
                  total: task.contextRepositoryPaths.length + 1
                })}
              />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ borderTop: "1px solid", borderColor: "divider", p: 1.5, maxHeight: 360, overflow: "auto" }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <Tooltip title={t("taskEngineering.implementation.copyContext")}>
                <span>
                  <Button
                    aria-label={t("taskEngineering.implementation.copyContextPack")}
                    size="small"
                    disabled={!contextQuery.data}
                    onClick={() => void navigator.clipboard.writeText(contextQuery.data?.content ?? "")}
                    sx={{ minWidth: 32, px: 0.75 }}
                  >
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </Button>
                </span>
              </Tooltip>
            </Stack>
            {contextQuery.isLoading ? <CircularProgress size={22} /> : contextQuery.error instanceof Error ? (
              <Alert severity="error">{contextQuery.error.message}</Alert>
            ) : (
              <Typography
                component="pre"
                variant="caption"
                sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--rc-font-mono)" }}
              >
                {contextQuery.data?.content}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Box>

      {latestRun ? (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.25 }}>
            {latestRun.status === "succeeded" ? (
              <CheckCircleOutlineIcon color="success" />
            ) : (
              <ErrorOutlineIcon color="error" />
            )}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {t("taskEngineering.implementation.lastRun", {
                  outcome: latestRun.status === "succeeded"
                    ? t("taskEngineering.implementation.succeeded")
                    : t("taskEngineering.implementation.failed")
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTaskDate(latestRun.completedAt, i18n.language)}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={latestRun.status === "succeeded" ? "success" : "error"}
              label={t("taskEngineering.implementation.checkChip", {
                passed: latestRun.checks.filter((check) => check.ok).length,
                total: latestRun.checks.length
              })}
            />
          </Stack>
          <Divider />
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {latestRun.error ? <Alert severity="error">{latestRun.error}</Alert> : null}
            {latestRun.status === "failed" ? (
              <Alert severity="warning">
                {t("taskEngineering.implementation.recoveryNotice")}
              </Alert>
            ) : null}
            {latestRun.response ? (
              <Typography
                component="pre"
                variant="body2"
                sx={{ m: 0, maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--rc-font-mono)" }}
              >
                {latestRun.response}
              </Typography>
            ) : null}
            <Stack spacing={0.75} aria-label={t("taskEngineering.implementation.checkResults")}>
              {latestRun.checks.map((check) => (
                <Accordion
                  key={check.id}
                  variant="outlined"
                  disableGutters
                  sx={{ "&:before": { display: "none" }, borderColor: check.ok ? "divider" : "error.main" }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: "100%", pr: 1 }}>
                      {check.ok ? (
                        <CheckCircleOutlineIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorOutlineIcon color="error" fontSize="small" />
                      )}
                      <Typography
                        variant="caption"
                        sx={{ fontFamily: "var(--rc-font-mono)", overflowWrap: "anywhere", flex: 1, minWidth: 0 }}
                      >
                        {check.command}
                      </Typography>
                      <Chip
                        size="small"
                        color={check.ok ? "success" : "error"}
                        variant="outlined"
                        label={`${check.ok ? "PASS" : "FAIL"} · ${formatDuration(check.durationMs)}`}
                      />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-1)" }}>
                    <Typography variant="caption" color="text.secondary">
                      {t("taskEngineering.implementation.exitCode", {
                        code: check.exitCode ?? t("taskEngineering.implementation.notAvailable")
                      })}
                    </Typography>
                    <Typography
                      component="pre"
                      variant="caption"
                      sx={{ m: 0, mt: 1, maxHeight: 260, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--rc-font-mono)" }}
                    >
                      {check.output || t("taskEngineering.implementation.noOutput")}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}
