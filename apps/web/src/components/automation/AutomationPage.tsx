import "@xyflow/react/dist/style.css";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
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
  Paper,
  Popover,
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
import { isActiveWorkflowRunStatus } from "./workflowRunStatus";

const ACTIVE_RUNS_POLL_INTERVAL_MS = 3_000;

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
  const [workflowMenuAnchor, setWorkflowMenuAnchor] = React.useState<HTMLElement | null>(null);
  const workflowsQuery = useQuery({ queryKey: ["workflows"], queryFn: fetchWorkflows });
  const runsQuery = useQuery({
    queryKey: ["workflow-runs"],
    queryFn: () => fetchWorkflowRuns(),
    refetchInterval: (query) => {
      const hasActiveRun = query.state.data?.runs.some((run) => isActiveWorkflowRunStatus(run.status));
      return hasActiveRun ? ACTIVE_RUNS_POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false
  });
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
      setWorkflowMenuAnchor(null);
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
    setWorkflowMenuAnchor(null);

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
    <Box
      component="section"
      aria-label="Lavagna automazioni"
      sx={{
        position: "relative",
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "transparent"
      }}
    >
      <Typography
        component="h1"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0
        }}
      >
        Automazioni
      </Typography>
      <Stack
        component="header"
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          minHeight: 48,
          px: { xs: 1, sm: 1.25 },
          flexShrink: 0,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.96),
          backdropFilter: "blur(16px)"
        }}
      >
        <Button
          variant="text"
          color="inherit"
          startIcon={<HubOutlinedIcon />}
          endIcon={<ArrowDropDownIcon />}
          aria-haspopup="menu"
          aria-expanded={Boolean(workflowMenuAnchor)}
          onClick={(event) => setWorkflowMenuAnchor(event.currentTarget)}
          sx={{
            minWidth: 0,
            maxWidth: { xs: 210, sm: 360 },
            minHeight: 36,
            px: 1,
            justifyContent: "flex-start",
            borderRadius: "var(--rc-radius-control)",
            "&:hover": { bgcolor: "action.hover" }
          }}
        >
          <Box component="span" sx={{ minWidth: 0, textAlign: "left" }}>
            <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.1 }}>
              Workflow attivo
            </Typography>
            <Typography component="span" variant="body2" fontWeight={500} noWrap sx={{ display: "block" }}>
              {selectedWorkflow?.name ?? "Seleziona workflow"}
            </Typography>
          </Box>
        </Button>
        <Chip
          size="small"
          variant="outlined"
          label={`${workflows.length} workflow`}
          sx={{ display: { xs: "none", sm: "flex" } }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={requestCreateWorkflow}
          sx={{ "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.75 } } }}
        >
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Nuovo</Box>
        </Button>
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

      <Box
        sx={{
          position: "relative",
          flexGrow: 1,
          minHeight: 0,
          overflow: "hidden"
        }}
      >
        {workflowsQuery.error instanceof Error ? (
          <Alert severity="error" sx={{ position: "absolute", zIndex: 5, top: 12, left: 12, right: 12 }}>
            {workflowsQuery.error.message}
          </Alert>
        ) : null}
        {runsQuery.error instanceof Error ? (
          <Alert severity="warning" sx={{ position: "absolute", zIndex: 5, top: 12, left: 12, right: 12 }}>
            {runsQuery.error.message}
          </Alert>
        ) : null}
        {selectedWorkflow ? (
          <AutomationWorkflowEditor
            key={selectedWorkflow.id}
            workflow={selectedWorkflow}
            projects={projects}
            runs={selectedRuns}
            onDeleted={handleWorkflowDeleted}
            onDirtyChange={setEditorDirty}
          />
        ) : workflowsQuery.isLoading ? (
          <Paper square sx={{ height: "100%", display: "grid", placeItems: "center" }}>
            <CircularProgress />
          </Paper>
        ) : (
          <Paper square sx={{ height: "100%", display: "grid", placeItems: "center", p: 3 }}>
            <Stack alignItems="center" spacing={1} sx={{ textAlign: "center" }}>
              <HubOutlinedIcon color="primary" />
              <Typography variant="h3">Nessun workflow selezionato</Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={requestCreateWorkflow}>
                Crea automazione
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>

      <Popover
        open={Boolean(workflowMenuAnchor)}
        anchorEl={workflowMenuAnchor}
        onClose={() => setWorkflowMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: { xs: "calc(100vw - 24px)", sm: 340 },
              maxWidth: 380,
              maxHeight: "min(70dvh, 620px)",
              overflow: "hidden"
            }
          }
        }}
      >
        <AutomationWorkflowList
          embedded
          workflows={workflows}
          runs={runs}
          selectedWorkflowId={selectedWorkflowId}
          loading={workflowsQuery.isLoading}
          onSelectWorkflow={requestWorkflowSelection}
          onCreateWorkflow={() => {
            setWorkflowMenuAnchor(null);
            requestCreateWorkflow();
          }}
        />
      </Popover>

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
    </Box>
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
