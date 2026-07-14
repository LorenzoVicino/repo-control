import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import type { ProjectSummary } from "../../types/projects";
import type { WorkflowNode } from "../../types/workflows";
import {
  getAutomationNodeDefinition,
  getConfigBoolean,
  getConfigString,
  getConfigStringArray
} from "./automationNodeCatalog";

type AutomationNodeInspectorProps = {
  node: WorkflowNode | null;
  projects: ProjectSummary[];
  onUpdateNode: (node: WorkflowNode) => void;
  onDeleteNode: (nodeId: string) => void;
};

export function AutomationNodeInspector({
  node,
  projects,
  onUpdateNode,
  onDeleteNode
}: AutomationNodeInspectorProps) {
  if (!node) {
    return (
      <InspectorShell title="Configurazione">
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
          <Typography variant="body2">Nessun nodo selezionato</Typography>
        </Box>
      </InspectorShell>
    );
  }

  const definition = getAutomationNodeDefinition(node.type);
  const selectedProjectIds = getConfigStringArray(node, "projectIds");
  const selectedProjects = projects.filter((project) => selectedProjectIds.includes(project.id));

  function updateConfig(config: Record<string, unknown>) {
    onUpdateNode({ ...node!, config: { ...node!.config, ...config } });
  }

  return (
    <InspectorShell title="Configurazione">
      <Stack spacing={2} sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            label={definition.group}
            sx={{ color: definition.color, borderColor: definition.color }}
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary" noWrap>{definition.label}</Typography>
        </Stack>

        <TextField
          size="small"
          label="Nome nodo"
          value={node.name}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => onUpdateNode({ ...node, name: event.target.value })}
        />

        {node.type === "repository.select" ? (
          <Stack spacing={1.5}>
            <FormControl size="small">
              <InputLabel id={`repository-mode-${node.id}`}>Selezione</InputLabel>
              <Select
                labelId={`repository-mode-${node.id}`}
                label="Selezione"
                value={getConfigString(node, "mode", "all")}
                onChange={(event) => updateConfig({ mode: event.target.value })}
              >
                <MenuItem value="all">Tutti</MenuItem>
                <MenuItem value="favorites">Preferiti</MenuItem>
                <MenuItem value="manual">Manuale</MenuItem>
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
              label="Checkout"
              value={getConfigString(node, "clean", "any")}
              options={[
                ["any", "Qualsiasi"],
                ["clean", "Pulito"],
                ["dirty", "Con modifiche"]
              ]}
              onChange={(value) => updateConfig({ clean: value })}
            />
            <NodeSelect
              id={`sync-${node.id}`}
              label="Sincronizzazione"
              value={getConfigString(node, "sync", "any")}
              options={[
                ["any", "Qualsiasi"],
                ["behind", "Da aggiornare"],
                ["ahead", "Da pubblicare"],
                ["diverged", "Divergente"]
              ]}
              onChange={(value) => updateConfig({ sync: value })}
            />
            <NodeSelect
              id={`docker-${node.id}`}
              label="Docker Compose"
              value={getConfigString(node, "docker", "any")}
              options={[
                ["any", "Qualsiasi"],
                ["yes", "Presente"],
                ["no", "Assente"]
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
            label="Richiedi checkout pulito"
          />
        ) : null}

        {node.type === "terminal.command" ? (
          <TextField
            size="small"
            label="Comando"
            value={getConfigString(node, "command", "")}
            onChange={(event) => updateConfig({ command: event.target.value })}
            multiline
            minRows={4}
            inputProps={{
              maxLength: 2000,
              style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }
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
          Elimina nodo
        </Button>
      </Stack>
    </InspectorShell>
  );
}

function InspectorShell({ title, children }: { title: string; children: React.ReactNode }) {
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
      <Box sx={{ position: "sticky", top: 0, zIndex: 1, px: 1.5, py: 1.25, bgcolor: "background.paper" }}>
        <Typography variant="subtitle2" fontWeight={800}>{title}</Typography>
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
