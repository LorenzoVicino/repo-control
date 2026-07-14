import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
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
import { fetchBrainContext, runBrainTask } from "../../api/brain";
import type { BrainTask } from "../../types/brain";
import { formatTaskDate, getTaskErrorMessage } from "./taskEngineeringUtils";

type ImplementationPanelProps = {
  projectId: string;
  task: BrainTask;
  onChanged: () => Promise<void>;
};

export function ImplementationPanel({ projectId, task, onChanged }: ImplementationPanelProps) {
  const [prompt, setPrompt] = React.useState("");
  const [checksText, setChecksText] = React.useState("npm run build");
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
    onError: (error) => setRunError(getTaskErrorMessage(error))
  });
  const latestRun = task.implementation.runs[0];

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        Checkout di esecuzione: repository principale. Context pack: {task.contextRepositoryPaths.length + 1} repository.
      </Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(320px, 0.72fr)" }, gap: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Istruzione aggiuntiva"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={3}
            placeholder="Vincoli specifici per questa iterazione"
          />
          <TextField
            label="Comandi di verifica"
            value={checksText}
            onChange={(event) => setChecksText(event.target.value)}
            multiline
            minRows={4}
            helperText="Un comando per riga. Almeno uno è obbligatorio."
            inputProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
          />
          {runError ? <Alert severity="error">{runError}</Alert> : null}
          <Button
            variant="contained"
            startIcon={runMutation.isPending ? <CircularProgress color="inherit" size={17} /> : <PlayArrowIcon />}
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !checksText.trim() || task.status !== "implementation"}
            sx={{ alignSelf: "flex-start" }}
          >
            {runMutation.isPending ? "Run in corso" : "Avvia iterazione"}
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ minWidth: 0, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025) }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AutoAwesomeOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Context pack</Typography>
            </Stack>
            <Tooltip title="Copia contesto">
              <span>
                <Button
                  aria-label="Copia context pack"
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
          <Divider />
          <Box sx={{ p: 1.5, maxHeight: 330, overflow: "auto" }}>
            {contextQuery.isLoading ? <CircularProgress size={22} /> : contextQuery.error instanceof Error ? (
              <Alert severity="error">{contextQuery.error.message}</Alert>
            ) : (
              <Typography
                component="pre"
                variant="caption"
                sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {contextQuery.data?.content}
              </Typography>
            )}
          </Box>
        </Paper>
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
                Ultimo run · {latestRun.status === "succeeded" ? "Riuscito" : "Fallito"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatTaskDate(latestRun.completedAt)}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={latestRun.status === "succeeded" ? "success" : "error"}
              label={`${latestRun.checks.filter((check) => check.ok).length}/${latestRun.checks.length} check`}
            />
          </Stack>
          <Divider />
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {latestRun.error ? <Alert severity="error">{latestRun.error}</Alert> : null}
            {latestRun.response ? (
              <Typography
                component="pre"
                variant="body2"
                sx={{ m: 0, maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              >
                {latestRun.response}
              </Typography>
            ) : null}
            <Stack spacing={0.75}>
              {latestRun.checks.map((check) => (
                <Stack key={check.id} direction="row" spacing={1} alignItems="center">
                  {check.ok ? (
                    <CheckCircleOutlineIcon color="success" fontSize="small" />
                  ) : (
                    <ErrorOutlineIcon color="error" fontSize="small" />
                  )}
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere" }}
                  >
                    {check.command}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
