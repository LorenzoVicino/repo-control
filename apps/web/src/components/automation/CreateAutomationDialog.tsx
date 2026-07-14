import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField
} from "@mui/material";
import React from "react";
import type { WorkflowDraft, WorkflowNodeType } from "../../types/workflows";
import { getAutomationNodeDefinition } from "./automationNodeCatalog";

type AutomationTemplate = "empty" | "sync-favorites" | "docker-up";

type CreateAutomationDialogProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (draft: WorkflowDraft) => void;
};

export function CreateAutomationDialog({
  open,
  loading,
  error,
  onClose,
  onCreate
}: CreateAutomationDialogProps) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [template, setTemplate] = React.useState<AutomationTemplate>("empty");

  React.useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setTemplate("empty");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nuova automazione</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            autoFocus
            label="Nome"
            value={name}
            inputProps={{ maxLength: 120 }}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label="Descrizione"
            value={description}
            inputProps={{ maxLength: 400 }}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
          />
          <FormControl>
            <InputLabel id="automation-template-label">Template</InputLabel>
            <Select
              labelId="automation-template-label"
              label="Template"
              value={template}
              onChange={(event) => setTemplate(event.target.value as AutomationTemplate)}
            >
              <MenuItem value="empty">Workflow vuoto</MenuItem>
              <MenuItem value="sync-favorites">Sincronizza preferiti</MenuItem>
              <MenuItem value="docker-up">Avvia progetti Docker</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Annulla</Button>
        <Button
          variant="contained"
          disabled={loading || !name.trim()}
          onClick={() => onCreate(buildAutomationDraft(name, description, template))}
        >
          {loading ? "Creazione" : "Crea workflow"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function buildAutomationDraft(name: string, description: string, template: AutomationTemplate): WorkflowDraft {
  const types = getTemplateNodeTypes(template);
  const id = crypto.randomUUID();
  const nodes = types.map((type, index) => {
    const definition = getAutomationNodeDefinition(type);

    return {
      id: `${id}-${index}`,
      type,
      name: definition.label,
      position: { x: 60 + index * 260, y: 180 },
      config: {
        ...definition.defaultConfig,
        ...(template === "sync-favorites" && type === "repository.select" ? { mode: "favorites" } : {}),
        ...(template === "sync-favorites" && type === "repository.filter" ? { clean: "clean" } : {}),
        ...(template === "docker-up" && type === "repository.filter" ? { docker: "yes" } : {})
      }
    };
  });

  return {
    name: name.trim(),
    description: description.trim(),
    active: false,
    nodes,
    edges: nodes.slice(0, -1).map((node, index) => ({
      id: `edge-${node.id}-${nodes[index + 1].id}`,
      source: node.id,
      target: nodes[index + 1].id
    }))
  };
}

function getTemplateNodeTypes(template: AutomationTemplate): WorkflowNodeType[] {
  if (template === "sync-favorites") {
    return [
      "trigger.manual",
      "repository.select",
      "repository.filter",
      "git.fetch",
      "git.pull",
      "output.summary"
    ];
  }

  if (template === "docker-up") {
    return ["trigger.manual", "repository.select", "repository.filter", "docker.up", "output.summary"];
  }

  return ["trigger.manual"];
}
