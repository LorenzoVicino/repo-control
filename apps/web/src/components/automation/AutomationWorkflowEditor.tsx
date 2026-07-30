import AddIcon from "@mui/icons-material/Add";
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
  IconButton,
  Popover,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { cancelWorkflowRun, deleteWorkflow, executeWorkflow, fetchWorkflowRun, updateWorkflow } from "../../api/workflows";
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
import { AutomationNodePalette } from "./AutomationNodePalette";
import { AutomationRunDialog } from "./AutomationRunDialog";
import { AutomationRunHistory } from "./AutomationRunHistory";
import {
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
import { isActiveWorkflowRunStatus } from "./workflowRunStatus";

const ACTIVE_RUN_POLL_INTERVAL_MS = 1_500;

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
  const [activeRunId, setActiveRunId] = React.useState<string | null>(null);
  const [executionMode, setExecutionMode] = React.useState<WorkflowRunMode | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);
  const [editorView, setEditorView] = React.useState<"editor" | "executions">("editor");
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
      openRun(run);
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
  const cancelMutation = useMutation({
    mutationFn: (runId: string) => cancelWorkflowRun(runId),
    onError: (error) => setEditorError(getErrorMessage(error))
  });
  const busy = saveMutation.isPending || runMutation.isPending || deleteMutation.isPending;

  // A run just started ("run" mode) is only ever a pending/running placeholder - its
  // up-to-date state comes from polling, not from the mutation result.
  const activeRunQuery = useQuery({
    queryKey: ["workflow-run", activeRunId],
    queryFn: () => fetchWorkflowRun(activeRunId as string),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isActiveWorkflowRunStatus(status) ? ACTIVE_RUN_POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false
  });
  const displayedRun = activeRunId ? activeRunQuery.data ?? null : runToDisplay;
  const previousActiveRunStatus = React.useRef<string | null>(null);

  React.useEffect(() => {
    const status = activeRunId ? activeRunQuery.data?.status ?? null : null;

    if (status && !isActiveWorkflowRunStatus(status) && previousActiveRunStatus.current !== status) {
      void queryClient.invalidateQueries({ queryKey: ["workflows"] });
      void queryClient.invalidateQueries({ queryKey: ["workflow-runs"] });
    }

    previousActiveRunStatus.current = status;
  }, [activeRunId, activeRunQuery.data?.status, queryClient]);

  function openRun(run: WorkflowRun) {
    if (isActiveWorkflowRunStatus(run.status)) {
      setRunToDisplay(null);
      setActiveRunId(run.id);
    } else {
      setActiveRunId(null);
      setRunToDisplay(run);
    }
  }

  function closeRunDialog() {
    setActiveRunId(null);
    setRunToDisplay(null);
  }

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
    <Box
      sx={{
        position: "relative",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "transparent"
      }}
    >
      <Stack
        component="header"
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{
          minHeight: 62,
          px: { xs: 0.5, sm: 1.5 },
          py: 0.75,
          flexShrink: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: (currentTheme) => alpha(currentTheme.palette.background.paper, 0.94),
          backdropFilter: "blur(16px)"
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            minWidth: 0,
            flex: "1 1 420px",
            display: { xs: "none", md: "flex" }
          }}
        >
          <Box sx={{ minWidth: 0, width: { xs: 160, md: 220, xl: 280 } }}>
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
                  py: 0.1,
                  fontSize: "0.95rem",
                  lineHeight: 1.3,
                  fontWeight: 850
                },
                "& .MuiInput-underline:before": { borderBottomColor: "transparent" },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottomColor: "divider" }
              }}
            />
            <TextField
              fullWidth
              variant="standard"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              inputProps={{ "aria-label": "Descrizione workflow", maxLength: 400 }}
              placeholder="Aggiungi una descrizione"
              sx={{
                display: { xs: "none", xl: "block" },
                "& .MuiInputBase-input": {
                  py: 0,
                  fontSize: "0.72rem",
                  lineHeight: 1.25,
                  color: "text.secondary"
                },
                "& .MuiInput-underline:before": { borderBottomColor: "transparent" },
                "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottomColor: "divider" }
              }}
            />
          </Box>
          <Tooltip title={validation.isRunnable ? "Workflow pronto" : firstValidationError?.message ?? "Workflow da completare"}>
            <Chip
              size="small"
              variant="outlined"
              color={validation.isRunnable ? "success" : "warning"}
              icon={validation.isRunnable ? <CheckCircleOutlineIcon /> : <WarningAmberOutlinedIcon />}
              label={validation.isRunnable ? "Pronto" : "Da completare"}
              sx={{ display: { xs: "none", md: "flex" }, flexShrink: 0 }}
            />
          </Tooltip>
          {dirty ? (
            <Box
              aria-label="Modifiche non salvate"
              sx={{
                width: 7,
                height: 7,
                flexShrink: 0,
                borderRadius: "50%",
                bgcolor: "info.main",
                boxShadow: (currentTheme) => `0 0 0 3px ${alpha(currentTheme.palette.info.main, 0.14)}`
              }}
            />
          ) : null}
        </Stack>

        <Tabs
          value={editorView}
          onChange={(_, nextView: "editor" | "executions") => {
            setEditorView(nextView);
            setSelectedNodeId(null);
            setNodeMenuAnchor(null);
          }}
          aria-label="Vista automazione"
          sx={{
            minHeight: 40,
            flexShrink: 0,
            "& .MuiTab-root": {
              minHeight: 40,
              minWidth: 0,
              px: { xs: 1, md: 1.5 },
              py: 0.5,
              fontSize: "0.78rem",
              textTransform: "none"
            }
          }}
        >
          <Tab value="editor" label="Editor" />
          <Tab
            value="executions"
            icon={<HistoryOutlinedIcon sx={{ fontSize: 17 }} />}
            iconPosition="start"
            label={
              <Box component="span">
                Esecuzioni
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}> {runs.length}</Box>
              </Box>
            }
          />
        </Tabs>

        <Stack
          direction="row"
          spacing={{ xs: 0.35, sm: 0.65 }}
          alignItems="center"
          sx={{ flex: { xs: "0 0 auto", md: "1 1 420px" }, justifyContent: "flex-end" }}
        >
          <Tooltip title={dirty ? "Salva modifiche" : "Nessuna modifica da salvare"}>
            <span>
              <Button
                size="small"
                variant="text"
                startIcon={saveMutation.isPending ? <CircularProgress size={15} /> : <SaveOutlinedIcon />}
                disabled={!dirty || busy || !name.trim()}
                onClick={() => saveMutation.mutate(draft)}
                sx={{
                  minWidth: { xs: 38, lg: 64 },
                  px: { xs: 0.75, lg: 1.25 },
                  "& .MuiButton-startIcon": { m: { xs: 0, lg: "0 8px 0 -4px" } }
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", lg: "inline" } }}>Salva</Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={runDisabledReason || "Controlla le azioni senza applicarle"}>
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={runMutation.isPending ? <CircularProgress size={15} /> : <PreviewOutlinedIcon />}
                disabled={busy || !name.trim() || !validation.isRunnable}
                onClick={() => openExecutionDialog("dry-run")}
                sx={{
                  minWidth: { xs: 42, lg: 92 },
                  px: { xs: 0.75, lg: 1.25 },
                  "& .MuiButton-startIcon": { m: { xs: 0, lg: "0 8px 0 -4px" } }
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", lg: "inline" } }}>Anteprima</Box>
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
                sx={{ whiteSpace: "nowrap" }}
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
                sx={{ display: { xs: "none", sm: "inline-flex" } }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {editorView === "editor" ? (
        <Box sx={{ position: "relative", flexGrow: 1, minHeight: 0, overflow: "hidden" }}>
          <Box
            sx={{
              minWidth: 0,
              minHeight: 0,
              height: "100%",
              bgcolor: (currentTheme) =>
                alpha(
                  currentTheme.palette.background.default,
                  currentTheme.palette.mode === "light" ? 0.9 : 0.86
                ),
              "& .react-flow__controls": {
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
                bgcolor: "background.paper",
                boxShadow: (currentTheme) => `0 10px 30px ${alpha(currentTheme.palette.common.black, 0.16)}`
              },
              "& .react-flow__controls-button": {
                width: 34,
                height: 34,
                borderBottomColor: "divider",
                bgcolor: "background.paper",
                fill: "text.primary",
                "&:hover": { bgcolor: "action.hover" }
              }
            }}
          >
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
              fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 0.9 }}
              minZoom={0.25}
              maxZoom={1.6}
              snapToGrid
              snapGrid={[20, 20]}
              colorMode={theme.palette.mode}
              defaultEdgeOptions={{
                type: "smoothstep",
                markerEnd: { type: MarkerType.ArrowClosed },
                style: { strokeWidth: 2, stroke: alpha(theme.palette.text.secondary, 0.78) }
              }}
              proOptions={{ hideAttribution: true }}
              aria-label="Canvas automazione"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.25}
                color={alpha(theme.palette.text.secondary, theme.palette.mode === "light" ? 0.24 : 0.2)}
              />
              <Controls showInteractive={false} position="bottom-left" />
              {editorError || firstValidationError || validation.warnings.length > 0 ? (
                <Panel position="top-left">
                  <Alert
                    severity={editorError ? "error" : firstValidationError ? "warning" : "info"}
                    role={editorError || firstValidationError ? "alert" : undefined}
                    onClose={editorError ? () => setEditorError(null) : undefined}
                    action={
                      !editorError && firstValidationError?.nodeId ? (
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => setSelectedNodeId(firstValidationError.nodeId ?? null)}
                        >
                          Configura
                        </Button>
                      ) : undefined
                    }
                    sx={{
                      maxWidth: { xs: "calc(100vw - 92px)", sm: 520 },
                      py: 0,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      boxShadow: 3,
                      "& .MuiAlert-message": { py: 0.65 }
                    }}
                  >
                    {editorError ?? firstValidationError?.message ?? validation.warnings[0]?.message}
                  </Alert>
                </Panel>
              ) : null}
              <Panel position="top-right">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  aria-label="Aggiungi passaggio"
                  aria-haspopup="dialog"
                  aria-expanded={Boolean(nodeMenuAnchor)}
                  onClick={(event) => setNodeMenuAnchor(event.currentTarget)}
                  sx={{
                    minWidth: { xs: 40, sm: 0 },
                    minHeight: 38,
                    px: { xs: 1, sm: 1.5 },
                    borderRadius: 1.5,
                    boxShadow: (currentTheme) => `0 10px 28px ${alpha(currentTheme.palette.common.black, 0.18)}`,
                    "& .MuiButton-startIcon": { m: { xs: 0, sm: "0 8px 0 -4px" } }
                  }}
                >
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    Aggiungi passaggio
                  </Box>
                </Button>
              </Panel>
            </ReactFlow>
          </Box>
          {selectedWorkflowNode ? (
            <Box
              sx={{
                position: "absolute",
                zIndex: 4,
                inset: "0 0 0 auto",
                width: { xs: "min(92vw, 380px)", sm: 380 },
                boxShadow: (currentTheme) => `-18px 0 44px ${alpha(currentTheme.palette.common.black, 0.18)}`
              }}
            >
              <AutomationNodeInspector
                node={selectedWorkflowNode}
                projects={projects}
                onClose={() => setSelectedNodeId(null)}
                onUpdateNode={updateNode}
                onDeleteNode={deleteNode}
              />
            </Box>
          ) : null}
        </Box>
      ) : (
        <Box
          component="section"
          aria-label="Esecuzioni workflow"
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflowY: "auto",
            p: { xs: 1.5, md: 3 },
            bgcolor: (currentTheme) => alpha(currentTheme.palette.background.default, 0.9)
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 980, mx: "auto" }}>
            <Stack direction="row" alignItems="flex-end" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h4" fontWeight={850}>Cronologia</Typography>
                <Typography variant="body2" color="text.secondary">
                  Controlla risultati, durata e stato delle ultime esecuzioni.
                </Typography>
              </Box>
              <Button variant="outlined" size="small" onClick={() => setEditorView("editor")}>
                Torna all’editor
              </Button>
            </Stack>
            <AutomationRunHistory
              runs={runs}
              onSelectRun={openRun}
            />
          </Box>
        </Box>
      )}

      <Popover
        anchorEl={nodeMenuAnchor}
        open={Boolean(nodeMenuAnchor)}
        onClose={() => setNodeMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: { xs: "min(92vw, 360px)", sm: 360 },
              height: "min(70dvh, 640px)",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              boxShadow: 12
            }
          }
        }}
      >
        <AutomationNodePalette
          nodeTypes={nodes.map((node) => node.data.workflowNode.type)}
          onAddNode={addNode}
          onClose={() => setNodeMenuAnchor(null)}
        />
      </Popover>

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

      <AutomationRunDialog
        run={displayedRun}
        onClose={closeRunDialog}
        onCancel={activeRunId ? () => cancelMutation.mutate(activeRunId) : undefined}
        cancelling={cancelMutation.isPending}
      />
    </Box>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
