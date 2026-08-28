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
import { useTranslation } from "react-i18next";
import type {
  WorkflowNode,
  WorkflowRunInputs,
  WorkflowRunMode
} from "../../types/workflows";
import { formatWorkflowIssue } from "./workflowIssues";
import {
  createInitialWorkflowRunInputs,
  getMissingRequiredWorkflowInputKeys,
  getWorkflowInputConfigurationIssue,
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
  const { t } = useTranslation();
  const definitions = React.useMemo(() => getWorkflowTextInputDefinitions(nodes), [nodes]);
  const configurationIssue = React.useMemo(
    () => getWorkflowInputConfigurationIssue(nodes),
    [nodes]
  );
  const [inputs, setInputs] = React.useState<WorkflowRunInputs>(
    () => createInitialWorkflowRunInputs(definitions)
  );
  const [missingInputKeys, setMissingInputKeys] = React.useState<string[]>([]);
  const isDryRun = mode === "dry-run";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMissingKeys = getMissingRequiredWorkflowInputKeys(definitions, inputs);
    setMissingInputKeys(nextMissingKeys);

    if (configurationIssue || nextMissingKeys.length > 0) {
      return;
    }

    onSubmit(inputs);
  }

  function updateInput(key: string, value: string) {
    setInputs((currentInputs) => ({ ...currentInputs, [key]: value }));
    setMissingInputKeys((currentKeys) =>
      currentKeys.includes(key) ? currentKeys.filter((currentKey) => currentKey !== key) : currentKeys
    );
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
          {isDryRun ? t("automation.execution.previewTitle") : t("automation.execution.runTitle")}
        </DialogTitle>
        <DialogContent dividers={definitions.length > 0}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {isDryRun
                ? t("automation.execution.previewDescription", { name: workflowName })
                : t("automation.execution.runDescription", { name: workflowName })}
            </Typography>

            {configurationIssue ? (
              <Alert severity="error">{formatWorkflowIssue(t, configurationIssue)}</Alert>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}
            {willSaveChanges ? (
              <Alert severity="info" variant="outlined">
                {t("automation.execution.willSaveChanges")}
              </Alert>
            ) : null}

            {definitions.length > 0 ? (
              <>
                <Alert severity="info" variant="outlined">
                  {t("automation.execution.inputsNotice")}
                </Alert>
                {definitions.map((definition, index) => (
                  <TextField
                    key={definition.nodeId}
                    autoFocus={index === 0}
                    required={definition.required}
                    label={definition.label || t("automation.nodeSummary.defaultInputLabel")}
                    name={definition.key}
                    value={inputs[definition.key] ?? ""}
                    placeholder={definition.placeholder}
                    error={missingInputKeys.includes(definition.key)}
                    helperText={missingInputKeys.includes(definition.key)
                      ? t("automation.issues.valueRequired")
                      : definition.description}
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
                {t("automation.execution.noInputs", { count: nodes.length })}
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t("common.cancel")}</Button>
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
            disabled={loading || Boolean(configurationIssue)}
          >
            {isDryRun ? t("automation.execution.generatePreview") : t("automation.execution.startRun")}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
