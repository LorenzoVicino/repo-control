import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CloudSyncOutlinedIcon from "@mui/icons-material/CloudSyncOutlined";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
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
      <DialogTitle>
        <Typography component="span" variant="h2">Nuova automazione</Typography>
        <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Parti da una base pronta oppure costruisci il flusso da zero.
        </Typography>
      </DialogTitle>
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
          <Stack spacing={0.75}>
            <Typography variant="subtitle2" fontWeight={800}>Scegli una base</Typography>
            <ToggleButtonGroup
              exclusive
              orientation="vertical"
              value={template}
              onChange={(_, value: AutomationTemplate | null) => {
                if (value) setTemplate(value);
              }}
              aria-label="Template automazione"
              fullWidth
              sx={{ gap: 0.75, "& .MuiToggleButtonGroup-grouped": { border: "1px solid !important", borderColor: "divider !important", borderRadius: "8px !important" } }}
            >
              <TemplateOption
                value="empty"
                icon={<AccountTreeOutlinedIcon />}
                title="Da zero"
                description="Solo il nodo di avvio, da completare liberamente."
              />
              <TemplateOption
                value="sync-favorites"
                icon={<CloudSyncOutlinedIcon />}
                title="Sincronizza preferiti"
                description="Fetch e pull sicuro dei repository preferiti e puliti."
              />
              <TemplateOption
                value="docker-up"
                icon={<RocketLaunchOutlinedIcon />}
                title="Avvia Docker"
                description="Seleziona i progetti Compose e avvia i servizi."
              />
            </ToggleButtonGroup>
          </Stack>
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

function TemplateOption({
  value,
  icon,
  title,
  description
}: {
  value: AutomationTemplate;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <ToggleButton
      value={value}
      sx={{
        minHeight: 66,
        px: 1.5,
        py: 1,
        justifyContent: "flex-start",
        textAlign: "left",
        textTransform: "none"
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        {icon}
        <Stack spacing={0.15}>
          <Typography variant="body2" fontWeight={800} color="text.primary">{title}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Stack>
      </Stack>
    </ToggleButton>
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
