import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  alpha,
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { ProjectSummary } from "../../types/projects";
import type { WorkflowNode } from "../../types/workflows";
import {
  getAutomationNodeDefinition,
  getAutomationNodeGroupLabel,
  getAutomationNodeLabel,
  getConfigBoolean,
  getConfigString,
  getConfigStringArray
} from "./automationNodeCatalog";
import { WORKFLOW_INPUT_KEY_PATTERN } from "./workflowInputs";

type AutomationNodeInspectorProps = {
  node: WorkflowNode | null;
  projects: ProjectSummary[];
  onClose: () => void;
  onUpdateNode: (node: WorkflowNode) => void;
  onDeleteNode: (nodeId: string) => void;
};

export function AutomationNodeInspector({
  node,
  projects,
  onClose,
  onUpdateNode,
  onDeleteNode
}: AutomationNodeInspectorProps) {
  const { t } = useTranslation();

  if (!node) {
    return (
      <InspectorShell title={t("automation.inspector.title")} onClose={onClose}>
        <Box
          sx={{
            minHeight: 150,
            display: "grid",
            placeItems: "center",
            px: 2,
            textAlign: "center",
            color: "text.secondary"
          }}
        >
          <Typography variant="body2">{t("automation.inspector.noSelection")}</Typography>
        </Box>
      </InspectorShell>
    );
  }

  const definition = getAutomationNodeDefinition(node.type);
  const DefinitionIcon = definition.icon;
  const selectedProjectIds = getConfigStringArray(node, "projectIds");
  const selectedProjects = projects.filter((project) => selectedProjectIds.includes(project.id));
  const inputKey = getConfigString(node, "key", "");
  const inputKeyInvalid = node.type === "input.text" && !WORKFLOW_INPUT_KEY_PATTERN.test(inputKey);

  function updateConfig(config: Record<string, unknown>) {
    onUpdateNode({ ...node!, config: { ...node!.config, ...config } });
  }

  return (
    <InspectorShell
      title={getAutomationNodeLabel(t, node.type)}
      subtitle={getAutomationNodeGroupLabel(t, definition.group)}
      icon={
        <Box
          sx={{
            width: 36,
            height: 36,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: "1px solid",
            borderColor: alpha(definition.color, 0.3),
            borderRadius: 1.25,
            color: definition.color,
            bgcolor: alpha(definition.color, 0.1)
          }}
        >
          <DefinitionIcon sx={{ fontSize: 20 }} />
        </Box>
      }
      onClose={onClose}
    >
      <Stack spacing={2} sx={{ p: 1.5 }}>
        <TextField
          size="small"
          label={t("automation.inspector.nodeName")}
          value={node.name}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => onUpdateNode({ ...node, name: event.target.value })}
        />

        {node.type === "input.text" ? (
          <Stack spacing={1.5}>
            <Alert severity="info" variant="outlined">
              {t("automation.inspector.inputNotice")}
            </Alert>
            <TextField
              size="small"
              label={t("automation.inspector.key")}
              value={inputKey}
              error={inputKeyInvalid}
              onChange={(event) => updateConfig({ key: event.target.value.toLowerCase() })}
              helperText={
                inputKeyInvalid
                  ? t("automation.inspector.keyHelp")
                  : `Nel comando terminale: {{inputs.${inputKey}}}`
              }
              inputProps={{ maxLength: 40 }}
            />
            <TextField
              size="small"
              label={t("automation.inspector.label")}
              value={getConfigString(node, "label", "")}
              onChange={(event) => updateConfig({ label: event.target.value })}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              size="small"
              label={t("automation.inspector.description")}
              value={getConfigString(node, "description", "")}
              onChange={(event) => updateConfig({ description: event.target.value })}
              inputProps={{ maxLength: 240 }}
              multiline
              minRows={2}
            />
            <TextField
              size="small"
              label={t("automation.inspector.placeholder")}
              value={getConfigString(node, "placeholder", "")}
              onChange={(event) => updateConfig({ placeholder: event.target.value })}
              inputProps={{ maxLength: 160 }}
            />
            <TextField
              size="small"
              label={t("automation.inspector.defaultValue")}
              value={getConfigString(node, "defaultValue", "")}
              onChange={(event) => updateConfig({ defaultValue: event.target.value })}
              inputProps={{ maxLength: 4000 }}
              multiline={getConfigBoolean(node, "multiline", false)}
              minRows={getConfigBoolean(node, "multiline", false) ? 3 : undefined}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={getConfigBoolean(node, "required", true)}
                  onChange={(event) => updateConfig({ required: event.target.checked })}
                />
              }
              label={t("automation.inspector.required")}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={getConfigBoolean(node, "multiline", false)}
                  onChange={(event) => updateConfig({ multiline: event.target.checked })}
                />
              }
              label={t("automation.inspector.multiline")}
            />
          </Stack>
        ) : null}

        {node.type === "repository.select" ? (
          <Stack spacing={1.5}>
            <FormControl size="small">
              <InputLabel id={`repository-mode-${node.id}`}>{t("automation.inspector.selection")}</InputLabel>
              <Select
                labelId={`repository-mode-${node.id}`}
                label={t("automation.inspector.selection")}
                value={getConfigString(node, "mode", "all")}
                onChange={(event) => updateConfig({ mode: event.target.value })}
              >
                <MenuItem value="all">{t("automation.inspector.modes.all")}</MenuItem>
                <MenuItem value="favorites">{t("automation.inspector.modes.favorites")}</MenuItem>
                <MenuItem value="manual">{t("automation.inspector.modes.manual")}</MenuItem>
              </Select>
            </FormControl>
            {getConfigString(node, "mode", "all") === "manual" ? (
              <Autocomplete
                multiple
                disableCloseOnSelect
                options={projects}
                value={selectedProjects}
                getOptionLabel={(project) => project.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, nextProjects) => updateConfig({ projectIds: nextProjects.map((project) => project.id) })}
                renderInput={(params) => <TextField {...params} size="small" label="Repository" />}
              />
            ) : null}
          </Stack>
        ) : null}

        {node.type === "repository.filter" ? (
          <Stack spacing={1.5}>
            <NodeSelect
              id={`clean-${node.id}`}
              label={t("automation.inspector.checkout")}
              value={getConfigString(node, "clean", "any")}
              options={[
                ["any", t("automation.inspector.checkoutOptions.any")],
                ["clean", t("automation.inspector.checkoutOptions.clean")],
                ["dirty", t("automation.inspector.checkoutOptions.dirty")]
              ]}
              onChange={(value) => updateConfig({ clean: value })}
            />
            <NodeSelect
              id={`sync-${node.id}`}
              label={t("automation.inspector.sync")}
              value={getConfigString(node, "sync", "any")}
              options={[
                ["any", t("automation.inspector.syncOptions.any")],
                ["behind", t("automation.inspector.syncOptions.behind")],
                ["ahead", t("automation.inspector.syncOptions.ahead")],
                ["diverged", t("automation.inspector.syncOptions.diverged")]
              ]}
              onChange={(value) => updateConfig({ sync: value })}
            />
            <NodeSelect
              id={`docker-${node.id}`}
              label={t("automation.inspector.docker")}
              value={getConfigString(node, "docker", "any")}
              options={[
                ["any", t("automation.inspector.dockerOptions.any")],
                ["yes", t("automation.inspector.dockerOptions.yes")],
                ["no", t("automation.inspector.dockerOptions.no")]
              ]}
              onChange={(value) => updateConfig({ docker: value })}
            />
          </Stack>
        ) : null}

        {node.type === "git.pull" || node.type === "git.pullDevelop" ? (
          <FormControlLabel
            control={
              <Switch
                checked={getConfigBoolean(node, "requireClean", true)}
                onChange={(event) => updateConfig({ requireClean: event.target.checked })}
              />
            }
            label={t("automation.inspector.requireClean")}
          />
        ) : null}

        {node.type === "terminal.command" ? (
          <TextField
            size="small"
            label={t("automation.inspector.command")}
            value={getConfigString(node, "command", "")}
            onChange={(event) => updateConfig({ command: event.target.value })}
            multiline
            minRows={4}
            inputProps={{
              maxLength: 2000,
              style: { fontFamily: "var(--rc-font-mono)", fontSize: 11.5 }
            }}
          />
        ) : null}

        <Divider />
        <Button
          color="error"
          variant="text"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => onDeleteNode(node.id)}
        >
          {t("automation.inspector.deleteNode")}
        </Button>
      </Stack>
    </InspectorShell>
  );
}

function InspectorShell({
  title,
  subtitle,
  icon,
  children,
  onClose
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box
      component="aside"
      sx={{
        minWidth: 0,
        height: "100%",
        overflowY: "auto",
        borderLeft: { lg: "1px solid" },
        borderTop: { xs: "1px solid", lg: 0 },
        borderColor: "divider",
        bgcolor: "background.paper"
      }}
    >
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          minHeight: 50,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper"
        }}
      >
        <Stack direction="row" spacing={1.1} alignItems="center" sx={{ minWidth: 0 }}>
          {icon}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={500} noWrap>{title}</Typography>
            {subtitle ? (
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        {onClose ? (
          <IconButton size="small" aria-label={t("automation.inspector.close")} onClick={onClose}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        ) : null}
      </Box>
      {children}
    </Box>
  );
}

function NodeSelect({
  id,
  label,
  value,
  options,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl size="small">
      <InputLabel id={id}>{label}</InputLabel>
      <Select labelId={id} label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
