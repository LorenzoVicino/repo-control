import "@xyflow/react/dist/style.css";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { createWorkflow, fetchWorkflowRuns, fetchWorkflows } from "../../api/workflows";
import type { ProjectSummary } from "../../types/projects";
import type { WorkflowDraft } from "../../types/workflows";
import { AutomationWorkflowEditor } from "./AutomationWorkflowEditor";
import { AutomationWorkflowList } from "./AutomationWorkflowList";
import { CreateAutomationDialog } from "./CreateAutomationDialog";

type AutomationPageProps = {
  projects: ProjectSummary[];
};

export function AutomationPage({ projects }: AutomationPageProps) {
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [editorDirty, setEditorDirty] = React.useState(false);
  const [pendingWorkflowId, setPendingWorkflowId] = React.useState<string | null>(null);
  const [createAfterDiscard, setCreateAfterDiscard] = React.useState(false);
  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: fetchWorkflows });
  const runsQuery = useQuery({ queryKey: ["workflow-runs"], queryFn: () => fetchWorkflowRuns() });
  const workflows = React.useMemo(
    () => workflowsQuery.data?.workflows ?? [],
    [workflowsQuery.data?.workflows]
  );
  const runs = runsQuery.data?.runs ?? [];
  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedRuns = selectedWorkflow ? runs.filter((run) => run.workflowId === selectedWorkflow.id) : [];
  const createMutation = useMutation({
    mutationFn: (draft: WorkflowDraft) => createWorkflow(draft),
    onSuccess: async (workflow) => {
      setCreateError(null);
      await queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setEditorDirty(false);
      setSelectedWorkflowId(workflow.id);
      setCreateDialogOpen(false);
    },
    onError: (error) => setCreateError(getErrorMessage(error))
  });

  React.useEffect(() => {
    if (!selectedWorkflowId || !workflows.some((workflow) => workflow.id === selectedWorkflowId)) {
      setSelectedWorkflowId(workflows[0]?.id ?? null);
    }
  }, [selectedWorkflowId, workflows]);

  React.useEffect(() => {
    if (!editorDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editorDirty]);

  async function handleWorkflowDeleted() {
    setEditorDirty(false);
    setSelectedWorkflowId(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflows"] }),
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
    ]);
  }

  function requestWorkflowSelection(workflowId: string) {
    if (workflowId === selectedWorkflowId) {
      return;
    }

    if (!editorDirty) {
      setSelectedWorkflowId(workflowId);
      return;
    }

    setPendingWorkflowId(workflowId);
  }

  function requestCreateWorkflow() {
    setCreateError(null);
    if (!editorDirty) {
      setCreateDialogOpen(true);
      return;
    }

    setCreateAfterDiscard(true);
  }

  function discardChangesAndContinue() {
    setEditorDirty(false);

    if (pendingWorkflowId) {
      setSelectedWorkflowId(pendingWorkflowId);
      setPendingWorkflowId(null);
      return;
    }

    if (createAfterDiscard) {
      setCreateAfterDiscard(false);
      setCreateDialogOpen(true);
    }
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="h1" variant="h1">Automazioni</Typography>
            <Chip size="small" color="secondary" variant="outlined" label={`${workflows.length} workflow`} />
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
            Crea flussi locali, controlla cosa verrà eseguito e verifica ogni risultato.
          </Typography>
        </Box>
        <Tooltip title="Aggiorna workflow">
          <span>
            <IconButton
              aria-label="Aggiorna workflow"
              onClick={() => void Promise.all([workflowsQuery.refetch(), runsQuery.refetch()])}
              disabled={workflowsQuery.isFetching || runsQuery.isFetching}
            >
              {workflowsQuery.isFetching || runsQuery.isFetching ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {workflowsQuery.error instanceof Error ? <Alert severity="error">{workflowsQuery.error.message}</Alert> : null}
      {runsQuery.error instanceof Error ? <Alert severity="warning">{runsQuery.error.message}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "260px minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start"
        }}
      >
        <AutomationWorkflowList
          workflows={workflows}
          runs={runs}
          selectedWorkflowId={selectedWorkflowId}
          loading={workflowsQuery.isLoading}
          onSelectWorkflow={requestWorkflowSelection}
          onCreateWorkflow={requestCreateWorkflow}
        />
        {selectedWorkflow ? (
          <AutomationWorkflowEditor
            key={`${selectedWorkflow.id}:${selectedWorkflow.updatedAt}`}
            workflow={selectedWorkflow}
            projects={projects}
            runs={selectedRuns}
            onDeleted={handleWorkflowDeleted}
            onDirtyChange={setEditorDirty}
          />
        ) : workflowsQuery.isLoading ? (
          <Paper variant="outlined" sx={{ minHeight: 520, display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center", p: 3 }}>
            <Stack alignItems="center" spacing={1} sx={{ textAlign: "center" }}>
              <HubOutlinedIcon color="primary" />
              <Typography variant="h3">Nessun workflow selezionato</Typography>
            </Stack>
          </Paper>
        )}
      </Box>

      <CreateAutomationDialog
        open={createDialogOpen}
        loading={createMutation.isPending}
        error={createError}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={(draft) => createMutation.mutate(draft)}
      />

      <Dialog
        open={Boolean(pendingWorkflowId) || createAfterDiscard}
        onClose={() => {
          setPendingWorkflowId(null);
          setCreateAfterDiscard(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Modifiche non salvate</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Se continui, le modifiche apportate a “{selectedWorkflow?.name ?? "questo workflow"}” verranno perse.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setPendingWorkflowId(null);
              setCreateAfterDiscard(false);
            }}
          >
            Resta qui
          </Button>
          <Button color="error" variant="contained" onClick={discardChangesAndContinue}>
            Scarta e continua
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
