import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PreviewOutlinedIcon from "@mui/icons-material/PreviewOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
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
  Panel,
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
  WorkflowDraft,
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
} from "./workflowInputs";
import { validateWorkflow } from "./workflowValidation";

const NODE_TYPES = { automation: AutomationNode };

type AutomationWorkflowEditorProps = {
  workflow: WorkflowDefinition;
  projects: ProjectSummary[];
  runs: WorkflowRun[];
  onDeleted: () => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};

export function AutomationWorkflowEditor({
  workflow,
  projects,
  runs,
  onDeleted,
  onDirtyChange
}: AutomationWorkflowEditorProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(workflow.name);
  const [description, setDescription] = React.useState(workflow.description);
  const active = workflow.active;
  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationFlowNode>(toFlowNodes(workflow.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(workflow.edges));
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [nodeMenuAnchor, setNodeMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [runToDisplay, setRunToDisplay] = React.useState<WorkflowRun | null>(null);
  const [executionMode, setExecutionMode] = React.useState<WorkflowRunMode | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [editorTab, setEditorTab] = React.useState<"builder" | "runs">("builder");
  const [savedDraftHash, setSavedDraftHash] = React.useState(
    () => JSON.stringify(toWorkflowDraft(workflow))
  );

  const draft = React.useMemo(
    () => buildWorkflowDraft(name, description, active, nodes, edges),
    [active, description, edges, name, nodes]
  );
  const dirty = JSON.stringify(draft) !== savedDraftHash;
  const validation = React.useMemo(
    () => validateWorkflow(draft.nodes, draft.edges),
    [draft.edges, draft.nodes]
  );
  const selectedFlowNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedWorkflowNode = selectedFlowNode
    ? { ...selectedFlowNode.data.workflowNode, position: selectedFlowNode.position }
    : null;

  React.useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  React.useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const saveMutation = useMutation({
    mutationFn: (draftToSave: WorkflowDraft) => updateWorkflow(workflow.id, draftToSave),
    onSuccess: async (savedWorkflow) => {
      setSavedDraftHash(JSON.stringify(toWorkflowDraft(savedWorkflow)));
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
        const savedWorkflow = await updateWorkflow(workflow.id, draft);
        setSavedDraftHash(JSON.stringify(toWorkflowDraft(savedWorkflow)));
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

    const incomingEdge = edges.find((edge) => edge.target === nodeId);
    const outgoingEdge = edges.find((edge) => edge.source === nodeId);

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId));
    setEdges((currentEdges) => {
      const remainingEdges = currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);

      if (!incomingEdge || !outgoingEdge) {
        return remainingEdges;
      }

      return addEdge(
        toFlowEdge({
          source: incomingEdge.source,
          target: outgoingEdge.target,
          sourceHandle: null,
          targetHandle: null
        }),
        remainingEdges
      );
    });
    setSelectedNodeId(null);
    setEditorError(null);
  }

  function openExecutionDialog(mode: WorkflowRunMode) {
    setEditorError(null);
    setExecutionMode(mode);
  }

  const firstValidationError = validation.errors[0] ?? null;
  const runDisabledReason = !name.trim()
    ? "Inserisci un nome per il workflow."
    : firstValidationError?.message ?? "";

  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Box sx={{ overflow: "hidden", border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
        <Stack
          direction={{ xs: "column", xl: "row" }}
          spacing={2}
          alignItems={{ xl: "center" }}
          justifyContent="space-between"
          sx={{ px: 2, py: 1.75 }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1, maxWidth: 720 }}>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="overline" color="text.secondary">Workflow</Typography>
              <Chip
                size="small"
                variant="outlined"
                color={validation.isRunnable ? "success" : "warning"}
                icon={validation.isRunnable ? <CheckCircleOutlineIcon /> : <WarningAmberOutlinedIcon />}
                label={validation.isRunnable ? "Pronta" : "Da completare"}
              />
              {dirty ? <Chip size="small" color="info" variant="outlined" label="Modifiche da salvare" /> : null}
            </Stack>
            <TextField
              fullWidth
              variant="standard"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ "aria-label": "Nome workflow", maxLength: 120 }}
              error={!name.trim()}
              placeholder="Nome workflow"
              sx={{
                "& .MuiInputBase-input": {
                  py: 0.25,
                  fontSize: "1.08rem",
                  lineHeight: 1.35,
                  fontWeight: 800
                }
              }}
            />
            <TextField
              fullWidth
              variant="standard"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              inputProps={{ "aria-label": "Descrizione workflow", maxLength: 400 }}
              placeholder="Descrivi cosa fa e quando usarla"
              sx={{ mt: 0.4, "& .MuiInputBase-input": { py: 0.35, color: "text.secondary" } }}
            />
          </Box>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(event) => setNodeMenuAnchor(event.currentTarget)}>
              Aggiungi nodo
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={saveMutation.isPending ? <CircularProgress size={15} /> : <SaveOutlinedIcon />}
              disabled={!dirty || busy || !name.trim()}
              onClick={() => saveMutation.mutate(draft)}
            >
              Salva
            </Button>
            <Tooltip title={runDisabledReason} disableHoverListener={!runDisabledReason}>
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={runMutation.isPending ? <CircularProgress size={15} /> : <PreviewOutlinedIcon />}
                  disabled={busy || !name.trim() || !validation.isRunnable}
                  onClick={() => openExecutionDialog("dry-run")}
                >
                  Anteprima
                </Button>
              </span>
            </Tooltip>
            <Tooltip title={runDisabledReason} disableHoverListener={!runDisabledReason}>
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  disabled={busy || !name.trim() || !validation.isRunnable}
                  onClick={() => openExecutionDialog("run")}
                >
                  Esegui
                </Button>
              </span>
            </Tooltip>
            <Tooltip title="Elimina workflow">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  aria-label="Elimina workflow"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={busy}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
        <Divider />
        <Tabs
          value={editorTab}
          onChange={(_, value: "builder" | "runs") => setEditorTab(value)}
          aria-label="Sezioni workflow"
          sx={{ px: 1.25, minHeight: 44 }}
        >
          <Tab value="builder" icon={<AccountTreeOutlinedIcon />} iconPosition="start" label="Editor" />
          <Tab value="runs" icon={<HistoryOutlinedIcon />} iconPosition="start" label={`Esecuzioni (${runs.length})`} />
        </Tabs>
        <Divider />

        {editorTab === "builder" ? (
          <>
            {editorError ? (
              <Alert severity="error" role="alert" onClose={() => setEditorError(null)} sx={{ borderRadius: 0 }}>
                {editorError}
              </Alert>
            ) : null}
            {firstValidationError ? (
              <Alert
                severity="warning"
                role="alert"
                icon={<WarningAmberOutlinedIcon />}
                action={
                  firstValidationError.nodeId ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setSelectedNodeId(firstValidationError.nodeId ?? null)}
                    >
                      Configura
                    </Button>
                  ) : undefined
                }
                sx={{ borderRadius: 0 }}
              >
                <Typography variant="body2" fontWeight={750}>{firstValidationError.message}</Typography>
                {validation.errors.length > 1 ? (
                  <Typography variant="caption">
                    Altri {validation.errors.length - 1} problemi da risolvere prima dell'esecuzione.
                  </Typography>
                ) : null}
              </Alert>
            ) : validation.warnings.length > 0 ? (
              <Alert severity="info" variant="outlined" sx={{ m: 1.25 }}>
                {validation.warnings[0]?.message}
              </Alert>
            ) : (
              <Alert severity="success" variant="outlined" sx={{ m: 1.25 }}>
                Il flusso è collegato e pronto per l'anteprima.
              </Alert>
            )}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  lg: selectedWorkflowNode ? "minmax(0, 1fr) 300px" : "minmax(0, 1fr)"
                },
                minHeight: { xs: selectedWorkflowNode ? 720 : 520, lg: 620 },
                height: { lg: "min(68dvh, 720px)" },
                borderTop: "1px solid",
                borderColor: "divider"
              }}
            >
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
                  fitView
                  fitViewOptions={{ padding: 0.16, minZoom: 0.35, maxZoom: 0.9 }}
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
                  {!selectedWorkflowNode ? (
                    <Panel position="top-right">
                      <Chip
                        size="small"
                        variant="outlined"
                        label="Seleziona un nodo per configurarlo"
                        sx={{ bgcolor: "background.paper" }}
                      />
                    </Panel>
                  ) : null}
                </ReactFlow>
              </Box>
              {selectedWorkflowNode ? (
                <AutomationNodeInspector
                  node={selectedWorkflowNode}
                  projects={projects}
                  onUpdateNode={updateNode}
                  onDeleteNode={deleteNode}
                />
              ) : null}
            </Box>
          </>
        ) : (
          <Box sx={{ p: 1.5, minHeight: 360, bgcolor: "background.default" }}>
            <AutomationRunHistory runs={runs} onSelectRun={setRunToDisplay} />
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={nodeMenuAnchor}
        open={Boolean(nodeMenuAnchor)}
        onClose={() => setNodeMenuAnchor(null)}
        MenuListProps={{ "aria-label": "Aggiungi nodo al workflow" }}
        slotProps={{ paper: { sx: { minWidth: 260, maxHeight: 520 } } }}
      >
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
          willSaveChanges={dirty}
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
