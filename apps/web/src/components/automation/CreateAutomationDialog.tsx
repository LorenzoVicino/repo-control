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
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import type { WorkflowDraft, WorkflowNodeType } from "../../types/workflows";
import { getAutomationNodeDefinition, getAutomationNodeLabel } from "./automationNodeCatalog";

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
  const { t } = useTranslation();
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
        <Typography component="span" variant="h2">{t("automation.create.title")}</Typography>
        <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("automation.create.subtitle")}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField
            autoFocus
            label={t("automation.create.nameLabel")}
            value={name}
            inputProps={{ maxLength: 120 }}
            onChange={(event) => setName(event.target.value)}
          />
          <TextField
            label={t("automation.create.descriptionLabel")}
            value={description}
            inputProps={{ maxLength: 400 }}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={2}
          />
          <Stack spacing={0.75}>
            <Typography variant="subtitle2" fontWeight={500}>{t("automation.create.chooseBase")}</Typography>
            <ToggleButtonGroup
              exclusive
              orientation="vertical"
              value={template}
              onChange={(_, value: AutomationTemplate | null) => {
                if (value) setTemplate(value);
              }}
              aria-label={t("automation.create.templateAriaLabel")}
              fullWidth
              sx={{ gap: 0.75, "& .MuiToggleButtonGroup-grouped": { border: "1px solid !important", borderColor: "divider !important", borderRadius: "8px !important" } }}
            >
              <TemplateOption
                value="empty"
                icon={<AccountTreeOutlinedIcon />}
                title={t("automation.create.templates.empty.title")}
                description={t("automation.create.templates.empty.description")}
              />
              <TemplateOption
                value="sync-favorites"
                icon={<CloudSyncOutlinedIcon />}
                title={t("automation.create.templates.syncFavorites.title")}
                description={t("automation.create.templates.syncFavorites.description")}
              />
              <TemplateOption
                value="docker-up"
                icon={<RocketLaunchOutlinedIcon />}
                title={t("automation.create.templates.dockerUp.title")}
                description={t("automation.create.templates.dockerUp.description")}
              />
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          disabled={loading || !name.trim()}
          onClick={() => onCreate(buildAutomationDraft(t, name, description, template))}
        >
          {loading ? t("automation.create.creating") : t("automation.createWorkflow")}
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
          <Typography variant="body2" fontWeight={500} color="text.primary">{title}</Typography>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Stack>
      </Stack>
    </ToggleButton>
  );
}

function buildAutomationDraft(
  t: TFunction,
  name: string,
  description: string,
  template: AutomationTemplate
): WorkflowDraft {
  const types = getTemplateNodeTypes(template);
  const id = crypto.randomUUID();
  const nodes = types.map((type, index) => {
    const definition = getAutomationNodeDefinition(type);

    return {
      id: `${id}-${index}`,
      type,
      name: getAutomationNodeLabel(t, definition.type),
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
