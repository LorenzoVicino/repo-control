import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import React from "react";
import type {
  WorkflowNode,
  WorkflowRunInputs,
  WorkflowRunMode
} from "../../types/workflows";
import {
  createInitialWorkflowRunInputs,
  getRequiredWorkflowInputErrors,
  getWorkflowInputConfigurationError,
  getWorkflowTextInputDefinitions
} from "./workflowInputs";

type AutomationExecutionDialogProps = {
  workflowName: string;
  mode: WorkflowRunMode;
  nodes: WorkflowNode[];
  willSaveChanges: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (inputs: WorkflowRunInputs) => void;
};

export function AutomationExecutionDialog({
  workflowName,
  mode,
  nodes,
  willSaveChanges,
  loading,
  error,
  onClose,
  onSubmit
}: AutomationExecutionDialogProps) {
  const definitions = React.useMemo(() => getWorkflowTextInputDefinitions(nodes), [nodes]);
  const configurationError = React.useMemo(
    () => getWorkflowInputConfigurationError(nodes),
    [nodes]
  );
  const [inputs, setInputs] = React.useState<WorkflowRunInputs>(
    () => createInitialWorkflowRunInputs(definitions)
  );
  const [inputErrors, setInputErrors] = React.useState<Record<string, string>>({});
  const isDryRun = mode === "dry-run";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = getRequiredWorkflowInputErrors(definitions, inputs);
    setInputErrors(nextErrors);

    if (configurationError || Object.keys(nextErrors).length > 0) {
      return;
    }

    onSubmit(inputs);
  }

  function updateInput(key: string, value: string) {
    setInputs((currentInputs) => ({ ...currentInputs, [key]: value }));
    setInputErrors((currentErrors) => {
      if (!currentErrors[key]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[key];
      return nextErrors;
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="automation-execution-title"
    >
      <Box component="form" noValidate onSubmit={handleSubmit}>
        <DialogTitle id="automation-execution-title">
          {isDryRun ? "Anteprima workflow" : "Esegui workflow"}
        </DialogTitle>
        <DialogContent dividers={definitions.length > 0}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {isDryRun
                ? `Genera l'anteprima di “${workflowName}” con i valori di questa esecuzione.`
                : `Avvia “${workflowName}” sul workspace corrente.`}
            </Typography>

            {configurationError ? <Alert severity="error">{configurationError}</Alert> : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            {willSaveChanges ? (
              <Alert severity="info" variant="outlined">
                Le modifiche correnti verranno salvate prima di generare questa esecuzione.
              </Alert>
            ) : null}

            {definitions.length > 0 ? (
              <>
                <Alert severity="info" variant="outlined">
                  Questi valori valgono solo per questa esecuzione. Non inserire password o token.
                </Alert>
                {definitions.map((definition, index) => (
                  <TextField
                    key={definition.nodeId}
                    autoFocus={index === 0}
                    required={definition.required}
                    label={definition.label}
                    name={definition.key}
                    value={inputs[definition.key] ?? ""}
                    placeholder={definition.placeholder}
                    error={Boolean(inputErrors[definition.key])}
                    helperText={inputErrors[definition.key] ?? definition.description}
                    onChange={(event) => updateInput(definition.key, event.target.value)}
                    inputProps={{ maxLength: 4000 }}
                    multiline={definition.multiline}
                    minRows={definition.multiline ? 3 : undefined}
                    autoComplete="off"
                  />
                ))}
              </>
            ) : (
              <Typography variant="body2">
                Il workflow contiene {nodes.length} {nodes.length === 1 ? "nodo" : "nodi"} e non richiede input.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>Annulla</Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={
              loading
                ? <CircularProgress size={16} color="inherit" />
                : isDryRun
                  ? <PreviewOutlinedIcon />
                  : <PlayArrowIcon />
            }
            disabled={loading || Boolean(configurationError)}
          >
            {isDryRun ? "Genera anteprima" : "Avvia esecuzione"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
