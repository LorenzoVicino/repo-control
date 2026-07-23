import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type OnBeforeDelete
} from "@xyflow/react";
import React from "react";
import { deleteWorkflow, executeWorkflow, updateWorkflow } from "../../api/workflows";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRun,
  WorkflowRunInputs,
  WorkflowRunMode
} from "../../types/workflows";
import type { ProjectSummary } from "../../types/projects";
import { AutomationExecutionDialog } from "./AutomationExecutionDialog";
import { AutomationNode, type AutomationFlowNode } from "./AutomationNode";
import { AutomationNodeInspector } from "./AutomationNodeInspector";
import { AutomationNodePalette } from "./AutomationNodePalette";
import { AutomationRunDialog } from "./AutomationRunDialog";
import { AutomationRunHistory } from "./AutomationRunHistory";
import {
  AUTOMATION_NODE_DEFINITIONS,
  getAutomationNodeDefinition
} from "./automationNodeCatalog";
import {
  buildWorkflowDraft,
  getConnectionSource,
  isLinearConnectionValid,
  toFlowEdge,
  toFlowEdges,
  toFlowNodes,
  toWorkflowDraft
} from "./automationWorkflowGraph";
import {
  getUniqueWorkflowInputKey,
  getWorkflowInputConfigurationError
} from "./workflowInputs";

const NODE_TYPES = { automation: AutomationNode };

type AutomationWorkflowEditorProps = {
  workflow: WorkflowDefinition;
  projects: ProjectSummary[];
  runs: WorkflowRun[];
  onDeleted: () => Promise<void>;
};

export function AutomationWorkflowEditor({
  workflow,
  projects,
  runs,
  onDeleted
}: AutomationWorkflowEditorProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(workflow.name);
  const [description, setDescription] = React.useState(workflow.description);
  const [active, setActive] = React.useState(workflow.active);
  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationFlowNode>(toFlowNodes(workflow.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(workflow.edges));
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [nodeMenuAnchor, setNodeMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [runToDisplay, setRunToDisplay] = React.useState<WorkflowRun | null>(null);
  const [executionMode, setExecutionMode] = React.useState<WorkflowRunMode | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);

  const draft = React.useMemo(
    () => buildWorkflowDraft(name, description, active, nodes, edges),
    [active, description, edges, name, nodes]
  );
  const initialDraftHash = React.useMemo(() => JSON.stringify(toWorkflowDraft(workflow)), [workflow]);
  const dirty = JSON.stringify(draft) !== initialDraftHash;
  const workflowInputConfigurationError = React.useMemo(
    () => getWorkflowInputConfigurationError(draft.nodes),
    [draft.nodes]
  );
  const selectedFlowNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedWorkflowNode = selectedFlowNode
    ? { ...selectedFlowNode.data.workflowNode, position: selectedFlowNode.position }
    : null;

  const saveMutation = useMutation({
    mutationFn: () => updateWorkflow(workflow.id, draft),
    onSuccess: async () => {
      setEditorError(null);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (error) => setEditorError(getErrorMessage(error))
  });
  const runMutation = useMutation({
    mutationFn: async ({
      mode,
      inputs
    }: {
      mode: WorkflowRunMode;
      inputs: WorkflowRunInputs;
    }) => {
      if (dirty) {
        await updateWorkflow(workflow.id, draft);
      }
      return executeWorkflow(workflow.id, mode, inputs);
    },
    onSuccess: async (run) => {
      setEditorError(null);
      setExecutionMode(null);
      setRunToDisplay(run);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflows"] }),
        queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
      ]);
    },
    onError: (error) => setEditorError(getErrorMessage(error))
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkflow(workflow.id),
    onSuccess: async () => {
      setConfirmDeleteOpen(false);
      await onDeleted();
    },
    onError: (error) => setEditorError(getErrorMessage(error))
  });
  const busy = saveMutation.isPending || runMutation.isPending || deleteMutation.isPending;

  const isValidConnection = React.useCallback(
    (connection: Edge | Connection) => isLinearConnectionValid(connection, edges),
    [edges]
  );
  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (!isLinearConnectionValid(connection, edges)) {
        setEditorError("Ogni nodo può avere una sola entrata e una sola uscita; i cicli non sono supportati.");
        return;
      }

      setEditorError(null);
      setEdges((currentEdges) => addEdge(toFlowEdge(connection), currentEdges));
    },
    [edges, setEdges]
  );
  const onBeforeDelete = React.useCallback<OnBeforeDelete<AutomationFlowNode, Edge>>(
    async ({ nodes: nodesToDelete }) => {
      if (nodes.length - nodesToDelete.length < 1) {
        setEditorError("Il workflow deve contenere almeno un nodo.");
        return false;
      }
      return true;
    },
    [nodes.length]
  );

  function addNode(type: WorkflowNodeType) {
    if (type === "trigger.manual" && nodes.some((node) => node.data.workflowNode.type === type)) {
      return;
    }

    const definition = getAutomationNodeDefinition(type);
    const sourceNode = getConnectionSource(nodes, edges, selectedNodeId);
    const defaultConfig = type === "input.text"
      ? {
          ...definition.defaultConfig,
          key: getUniqueWorkflowInputKey(nodes.map((node) => node.data.workflowNode))
        }
      : { ...definition.defaultConfig };
    const newNode: AutomationFlowNode = {
      id: crypto.randomUUID(),
      type: "automation",
      position: {
        x: nodes.length > 0 ? Math.max(...nodes.map((node) => node.position.x)) + 280 : 80,
        y: sourceNode?.position.y ?? 180
      },
      data: {
        workflowNode: {
          id: "",
          type,
          name: definition.label,
          position: { x: 0, y: 0 },
          config: defaultConfig
        }
      }
    };
    newNode.data.workflowNode.id = newNode.id;
    newNode.data.workflowNode.position = newNode.position;

    setNodes((currentNodes) => [...currentNodes, newNode]);
    if (sourceNode && type !== "trigger.manual") {
      setEdges((currentEdges) => addEdge(toFlowEdge({ source: sourceNode.id, target: newNode.id, sourceHandle: null, targetHandle: null }), currentEdges));
    }
    setSelectedNodeId(newNode.id);
    setNodeMenuAnchor(null);
    setEditorError(null);
  }

  function updateNode(updatedNode: WorkflowNode) {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === updatedNode.id
          ? {
              ...node,
              data: {
                workflowNode: { ...updatedNode, position: node.position }
              }
            }
          : node
      )
    );
  }

  function deleteNode(nodeId: string) {
    if (nodes.length <= 1) {
      setEditorError("Il workflow deve contenere almeno un nodo.");
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNodeId(null);
  }

  function openExecutionDialog(mode: WorkflowRunMode) {
    setEditorError(null);
    setExecutionMode(mode);
  }

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Box sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={1.5}
          alignItems={{ xl: "center" }}
          justifyContent="space-between"
          sx={{ px: 1.5, py: 1.25 }}
        >
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(180px, 0.7fr) minmax(220px, 1fr)" }, gap: 1, minWidth: 0, flexGrow: 1 }}>
            <TextField
              size="small"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ "aria-label": "Nome workflow", maxLength: 120 }}
              error={!name.trim()}
              placeholder="Nome workflow"
            />
            <TextField
              size="small"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              inputProps={{ "aria-label": "Descrizione workflow", maxLength: 400 }}
              placeholder="Descrizione"
            />
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <FormControlLabel
              sx={{ ml: 0, mr: 0.5 }}
              control={<Switch size="small" checked={active} onChange={(event) => setActive(event.target.checked)} />}
              label={<Typography variant="body2">Attivo</Typography>}
            />
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(event) => setNodeMenuAnchor(event.currentTarget)}>
              Nodo
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={saveMutation.isPending ? <CircularProgress size={15} /> : <SaveOutlinedIcon />}
              disabled={!dirty || busy || !name.trim() || Boolean(workflowInputConfigurationError)}
              onClick={() => saveMutation.mutate()}
            >
              Salva
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={runMutation.isPending ? <CircularProgress size={15} /> : <PreviewOutlinedIcon />}
              disabled={busy || !name.trim() || Boolean(workflowInputConfigurationError)}
              onClick={() => openExecutionDialog("dry-run")}
            >
              Anteprima
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              disabled={busy || !name.trim() || Boolean(workflowInputConfigurationError)}
              onClick={() => openExecutionDialog("run")}
            >
              Esegui
            </Button>
            <Tooltip title="Elimina workflow">
              <span>
                <IconButton size="small" color="error" onClick={() => setConfirmDeleteOpen(true)} disabled={busy}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
        <Divider />
        {editorError ? <Alert severity="warning" onClose={() => setEditorError(null)} sx={{ borderRadius: 0 }}>{editorError}</Alert> : null}
        {workflowInputConfigurationError ? (
          <Alert severity="error" sx={{ borderRadius: 0 }}>
            {workflowInputConfigurationError}
          </Alert>
        ) : null}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "184px minmax(0, 1fr) 272px" },
            minHeight: { xs: 720, lg: 620 },
            height: { lg: "min(68dvh, 720px)" }
          }}
        >
          <Box sx={{ display: { xs: "none", lg: "block" }, minHeight: 0 }}>
            <AutomationNodePalette
              nodeTypes={nodes.map((node) => node.data.workflowNode.type)}
              onAddNode={addNode}
            />
          </Box>
          <Box sx={{ minWidth: 0, minHeight: { xs: 500, lg: 0 }, height: { xs: 500, lg: "100%" }, bgcolor: "background.default" }}>
            <ReactFlow<AutomationFlowNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onBeforeDelete={onBeforeDelete}
              onNodesDelete={() => setSelectedNodeId(null)}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              isValidConnection={isValidConnection}
              defaultViewport={{ x: 24, y: 80, zoom: 0.85 }}
              minZoom={0.25}
              maxZoom={1.6}
              snapToGrid
              snapGrid={[20, 20]}
              colorMode={theme.palette.mode}
              defaultEdgeOptions={{
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { strokeWidth: 1.8, stroke: theme.palette.text.secondary }
              }}
              proOptions={{ hideAttribution: true }}
              aria-label="Canvas automazione"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1.2}
                color={alpha(theme.palette.text.secondary, 0.22)}
              />
              <Controls showInteractive={false} position="bottom-left" />
            </ReactFlow>
          </Box>
          <AutomationNodeInspector
            node={selectedWorkflowNode}
            projects={projects}
            onUpdateNode={updateNode}
            onDeleteNode={deleteNode}
          />
        </Box>
      </Box>

      <AutomationRunHistory runs={runs} onSelectRun={setRunToDisplay} />

      <Menu anchorEl={nodeMenuAnchor} open={Boolean(nodeMenuAnchor)} onClose={() => setNodeMenuAnchor(null)}>
        {AUTOMATION_NODE_DEFINITIONS.map((definition) => {
          const Icon = definition.icon;
          const disabled = definition.type === "trigger.manual" && nodes.some((node) => node.data.workflowNode.type === definition.type);
          return (
            <MenuItem key={definition.type} disabled={disabled} onClick={() => addNode(definition.type)}>
              <ListItemIcon><Icon fontSize="small" sx={{ color: definition.color }} /></ListItemIcon>
              <ListItemText primary={definition.label} secondary={definition.group} />
            </MenuItem>
          );
        })}
      </Menu>

      {executionMode ? (
        <AutomationExecutionDialog
          key={executionMode}
          workflowName={name.trim() || workflow.name}
          mode={executionMode}
          nodes={draft.nodes}
          loading={runMutation.isPending}
          error={editorError}
          onClose={() => setExecutionMode(null)}
          onSubmit={(inputs) => runMutation.mutate({ mode: executionMode, inputs })}
        />
      ) : null}

      <Dialog open={confirmDeleteOpen} onClose={deleteMutation.isPending ? undefined : () => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Elimina workflow</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Il workflow “{workflow.name}” verrà rimosso definitivamente.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={deleteMutation.isPending}>Annulla</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Elimina</Button>
        </DialogActions>
      </Dialog>

      <AutomationRunDialog run={runToDisplay} onClose={() => setRunToDisplay(null)} />
    </Stack>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
