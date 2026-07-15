import "@xyflow/react/dist/style.css";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
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

  async function handleWorkflowDeleted() {
    setSelectedWorkflowId(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflows"] }),
      queryClient.invalidateQueries({ queryKey: ["workflow-runs"] })
    ]);
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1.5} alignItems="flex-end" justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="h1" variant="h1">Automazioni</Typography>
            <Chip size="small" color="secondary" variant="outlined" label="Visual workflows" />
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
            Workflow locali per coordinare repository, Git, Docker e comandi.
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
          gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "250px minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start"
        }}
      >
        <AutomationWorkflowList
          workflows={workflows}
          runs={runs}
          selectedWorkflowId={selectedWorkflowId}
          loading={workflowsQuery.isLoading}
          onSelectWorkflow={setSelectedWorkflowId}
          onCreateWorkflow={() => {
            setCreateError(null);
            setCreateDialogOpen(true);
          }}
        />
        {selectedWorkflow ? (
          <AutomationWorkflowEditor
            key={`${selectedWorkflow.id}:${selectedWorkflow.updatedAt}`}
            workflow={selectedWorkflow}
            projects={projects}
            runs={selectedRuns}
            onDeleted={handleWorkflowDeleted}
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
    </Stack>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
