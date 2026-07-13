import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
  Divider,
  FormControl,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import {
  approveBrainTask,
  createBrainTask,
  fetchBrainContext,
  fetchBrainTasks,
  runBrainTask,
  updateBrainTask
} from "../../api/client";
import type {
  BrainContentPhase,
  BrainGatePhase,
  BrainTask,
  BrainTaskStatus,
  BrainTaskType,
  ProjectSummary
} from "../../types";

type TaskEngineeringPageProps = {
  projects: ProjectSummary[];
};

const PHASES: Array<{ id: BrainGatePhase; label: string }> = [
  { id: "definition", label: "Definizione" },
  { id: "requirements", label: "Requisiti" },
  { id: "design", label: "Design" },
  { id: "breakdown", label: "Piano" },
  { id: "implementation", label: "Implementazione" }
];

const STATUS_ORDER: BrainTaskStatus[] = ["definition", "requirements", "design", "breakdown", "implementation", "done"];
const TASK_TYPE_LABELS: Record<BrainTaskType, string> = {
  feature: "Feature",
  fix: "Fix",
  refactor: "Refactor",
  chore: "Chore",
  spike: "Spike"
};

export function TaskEngineeringPage({ projects }: TaskEngineeringPageProps) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    if (!projects.some((project) => project.id === projectId)) {
      setProjectId(projects[0]?.id ?? "");
    }
  }, [projectId, projects]);

  const tasksQuery = useQuery({
    queryKey: ["brain-tasks", projectId],
    queryFn: () => fetchBrainTasks(projectId),
    enabled: Boolean(projectId)
  });
  const tasks = tasksQuery.data?.tasks ?? [];

  React.useEffect(() => {
    if (!selectedTaskId || !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0]?.id ?? null);
    }
  }, [selectedTaskId, tasks]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;

  async function refreshTasks() {
    await queryClient.invalidateQueries({ queryKey: ["brain-tasks", projectId] });
  }

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="h1" variant="h1">
              Task engineering
            </Typography>
            <Chip size="small" color="primary" variant="outlined" label="Spec driven" />
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
            Specifica, contesto operativo ed evidenze in un unico flusso controllato.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: { xs: "100%", md: "auto" } }}>
          <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 260 }, flexGrow: { xs: 1, md: 0 } }}>
            <InputLabel id="task-project-label">Repository</InputLabel>
            <Select
              labelId="task-project-label"
              label="Repository"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                setSelectedTaskId(null);
              }}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Aggiorna task">
            <span>
              <Button
                variant="outlined"
                aria-label="Aggiorna task"
                onClick={() => void tasksQuery.refetch()}
                disabled={tasksQuery.isFetching || !projectId}
                sx={{ minWidth: 40, px: 1 }}
              >
                {tasksQuery.isFetching ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
              </Button>
            </span>
          </Tooltip>
          <Button startIcon={<AddIcon />} variant="contained" onClick={() => setCreateOpen(true)} disabled={!projectId}>
            Nuovo task
          </Button>
        </Stack>
      </Stack>

      {tasksQuery.error instanceof Error ? <Alert severity="error">{tasksQuery.error.message}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "280px minmax(0, 1fr)" },
          gap: 2,
          alignItems: "start"
        }}
      >
        <TaskList tasks={tasks} selectedTaskId={selectedTaskId} loading={tasksQuery.isLoading} onSelect={setSelectedTaskId} />
        {selectedTask ? (
          <TaskWorkbench key={`${selectedTask.id}:${selectedTask.updatedAt}`} projectId={projectId} task={selectedTask} onChanged={refreshTasks} />
        ) : (
          <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center", p: 3 }}>
            <Stack alignItems="center" spacing={1} sx={{ maxWidth: 360, textAlign: "center" }}>
              <AutoAwesomeOutlinedIcon color="primary" />
              <Typography variant="h3">Nessun task selezionato</Typography>
              <Typography variant="body2" color="text.secondary">
                Crea un task per iniziare dalla definizione e costruire il context pack.
              </Typography>
            </Stack>
          </Paper>
        )}
      </Box>

      <CreateTaskDialog
        open={createOpen}
        projectId={projectId}
        onClose={() => setCreateOpen(false)}
        onCreated={async (task) => {
          setCreateOpen(false);
          await refreshTasks();
          setSelectedTaskId(task.id);
        }}
      />
    </Stack>
  );
}

function TaskList({
  tasks,
  selectedTaskId,
  loading,
  onSelect
}: {
  tasks: BrainTask[];
  selectedTaskId: string | null;
  loading: boolean;
  onSelect: (taskId: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", position: { lg: "sticky" }, top: { lg: 92 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Task</Typography>
        <Chip size="small" variant="outlined" label={tasks.length} />
      </Stack>
      <Divider />
      {loading ? (
        <Box sx={{ minHeight: 180, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nessun task per questo repository.</Typography>
      ) : (
        <List disablePadding sx={{ maxHeight: { lg: "calc(100dvh - 250px)" }, overflowY: "auto" }}>
          {tasks.map((task) => (
            <ListItemButton
              key={task.id}
              selected={task.id === selectedTaskId}
              onClick={() => onSelect(task.id)}
              sx={{ alignItems: "flex-start", py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <ListItemText
                primary={task.title}
                secondary={
                  <Stack component="span" direction="row" spacing={0.75} sx={{ mt: 0.75 }}>
                    <Chip component="span" size="small" label={TASK_TYPE_LABELS[task.type]} />
                    <Chip component="span" size="small" color={task.status === "done" ? "success" : "primary"} variant="outlined" label={statusLabel(task.status)} />
                  </Stack>
                }
                primaryTypographyProps={{ variant: "body2", fontWeight: 750, noWrap: true }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}

function TaskWorkbench({ projectId, task, onChanged }: { projectId: string; task: BrainTask; onChanged: () => Promise<void> }) {
  const [phase, setPhase] = React.useState<BrainGatePhase>(task.status === "done" ? "implementation" : task.status);
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.definition.description);
  const [motivation, setMotivation] = React.useState(task.definition.motivation);
  const [content, setContent] = React.useState(phase === "definition" || phase === "implementation" ? "" : task[phase].content);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (phase !== "definition" && phase !== "implementation") {
      setContent(task[phase].content);
    }
  }, [phase, task]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (phase === "definition") {
        return updateBrainTask(projectId, task.id, { title, definition: { description, motivation } });
      }
      if (phase === "implementation") return task;
      return updateBrainTask(projectId, task.id, { phase: phase as BrainContentPhase, content });
    },
    onSuccess: onChanged,
    onError: (mutationError) => setError(getErrorMessage(mutationError))
  });
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (phase !== "implementation") await saveMutation.mutateAsync();
      return approveBrainTask(projectId, task.id, phase);
    },
    onSuccess: async (nextTask) => {
      setError(null);
      await onChanged();
      setPhase(nextTask.status === "done" ? "implementation" : nextTask.status);
    },
    onError: (mutationError) => setError(getErrorMessage(mutationError))
  });

  const currentPhaseIndex = STATUS_ORDER.indexOf(task.status);
  const busy = saveMutation.isPending || approveMutation.isPending;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", minWidth: 0 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" sx={{ p: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" noWrap>{task.title}</Typography>
          <Typography variant="caption" color="text.secondary">Aggiornato {formatDate(task.updatedAt)}</Typography>
        </Box>
        <Chip color={task.status === "done" ? "success" : "primary"} variant="outlined" label={statusLabel(task.status)} />
      </Stack>
      <Divider />
      <Box sx={{ overflowX: "auto", px: 1, py: 1 }}>
        <Stack direction="row" spacing={0.5} sx={{ minWidth: 660 }}>
          {PHASES.map((item, index) => {
            const unlocked = index <= currentPhaseIndex || task.status === "done";
            const approved = index < currentPhaseIndex || task.status === "done";
            return (
              <Button
                key={item.id}
                size="small"
                disabled={!unlocked}
                onClick={() => setPhase(item.id)}
                variant={phase === item.id ? "contained" : "text"}
                color={approved && phase !== item.id ? "success" : "primary"}
                startIcon={approved ? <CheckCircleOutlineIcon fontSize="small" /> : undefined}
                sx={{ minWidth: 124, flex: 1 }}
              >
                {item.label}
              </Button>
            );
          })}
        </Stack>
      </Box>
      <Divider />

      <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {phase === "definition" ? (
          <Stack spacing={2}>
            <TextField label="Titolo" value={title} onChange={(event) => setTitle(event.target.value)} fullWidth />
            <TextField label="Descrizione" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={5} fullWidth />
            <TextField label="Motivazione" value={motivation} onChange={(event) => setMotivation(event.target.value)} multiline minRows={3} fullWidth />
          </Stack>
        ) : phase === "implementation" ? (
          <ImplementationPanel projectId={projectId} task={task} onChanged={onChanged} />
        ) : (
          <TextField
            label={PHASES.find((item) => item.id === phase)?.label}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            multiline
            minRows={14}
            fullWidth
            inputProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13.5, lineHeight: 1.55 } }}
          />
        )}

        {phase !== "implementation" ? (
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => saveMutation.mutate()} disabled={busy}>Salva</Button>
            <Button variant="contained" onClick={() => approveMutation.mutate()} disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}>
              Approva e continua
            </Button>
          </Stack>
        ) : task.status === "implementation" ? (
          <Stack alignItems="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" color="success" onClick={() => approveMutation.mutate()} disabled={busy} startIcon={<CheckCircleOutlineIcon />}>
              Chiudi task
            </Button>
          </Stack>
        ) : null}
      </Box>
    </Paper>
  );
}

function ImplementationPanel({ projectId, task, onChanged }: { projectId: string; task: BrainTask; onChanged: () => Promise<void> }) {
  const [prompt, setPrompt] = React.useState("");
  const [checksText, setChecksText] = React.useState("npm run build");
  const [runError, setRunError] = React.useState<string | null>(null);
  const contextQuery = useQuery({
    queryKey: ["brain-context", projectId, task.id, task.updatedAt],
    queryFn: () => fetchBrainContext(projectId, task.id)
  });
  const runMutation = useMutation({
    mutationFn: () => runBrainTask(projectId, task.id, {
      prompt,
      checks: checksText.split("\n").map((check) => check.trim()).filter(Boolean)
    }),
    onSuccess: async () => {
      setRunError(null);
      await onChanged();
    },
    onError: (error) => setRunError(getErrorMessage(error))
  });
  const latestRun = task.implementation.runs[0];

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        Il run modifica il checkout corrente del repository selezionato. I comandi sotto vengono eseguiti solo dopo la risposta di Claude.
      </Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(320px, 0.72fr)" }, gap: 2 }}>
        <Stack spacing={2}>
          <TextField
            label="Istruzione aggiuntiva"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            multiline
            minRows={3}
            placeholder="Vincoli specifici per questa iterazione"
          />
          <TextField
            label="Comandi di verifica"
            value={checksText}
            onChange={(event) => setChecksText(event.target.value)}
            multiline
            minRows={4}
            helperText="Un comando per riga. Almeno uno è obbligatorio."
            inputProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" } }}
          />
          {runError ? <Alert severity="error">{runError}</Alert> : null}
          <Button
            variant="contained"
            startIcon={runMutation.isPending ? <CircularProgress color="inherit" size={17} /> : <PlayArrowIcon />}
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending || !checksText.trim() || task.status !== "implementation"}
            sx={{ alignSelf: "flex-start" }}
          >
            {runMutation.isPending ? "Run in corso" : "Avvia iterazione"}
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ minWidth: 0, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025) }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AutoAwesomeOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Context pack</Typography>
            </Stack>
            <Tooltip title="Copia contesto">
              <span>
                <Button
                  aria-label="Copia context pack"
                  size="small"
                  disabled={!contextQuery.data}
                  onClick={() => void navigator.clipboard.writeText(contextQuery.data?.content ?? "")}
                  sx={{ minWidth: 32, px: 0.75 }}
                >
                  <ContentCopyOutlinedIcon fontSize="small" />
                </Button>
              </span>
            </Tooltip>
          </Stack>
          <Divider />
          <Box sx={{ p: 1.5, maxHeight: 330, overflow: "auto" }}>
            {contextQuery.isLoading ? <CircularProgress size={22} /> : contextQuery.error instanceof Error ? (
              <Alert severity="error">{contextQuery.error.message}</Alert>
            ) : (
              <Typography component="pre" variant="caption" sx={{ m: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {contextQuery.data?.content}
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>

      {latestRun ? (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.25 }}>
            {latestRun.status === "succeeded" ? <CheckCircleOutlineIcon color="success" /> : <ErrorOutlineIcon color="error" />}
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Ultimo run · {latestRun.status === "succeeded" ? "Riuscito" : "Fallito"}</Typography>
              <Typography variant="caption" color="text.secondary">{formatDate(latestRun.completedAt)}</Typography>
            </Box>
            <Chip size="small" color={latestRun.status === "succeeded" ? "success" : "error"} label={`${latestRun.checks.filter((check) => check.ok).length}/${latestRun.checks.length} check`} />
          </Stack>
          <Divider />
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {latestRun.error ? <Alert severity="error">{latestRun.error}</Alert> : null}
            {latestRun.response ? (
              <Typography component="pre" variant="body2" sx={{ m: 0, maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {latestRun.response}
              </Typography>
            ) : null}
            <Stack spacing={0.75}>
              {latestRun.checks.map((check) => (
                <Stack key={check.id} direction="row" spacing={1} alignItems="center">
                  {check.ok ? <CheckCircleOutlineIcon color="success" fontSize="small" /> : <ErrorOutlineIcon color="error" fontSize="small" />}
                  <Typography variant="caption" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", overflowWrap: "anywhere" }}>{check.command}</Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

function CreateTaskDialog({ open, projectId, onClose, onCreated }: { open: boolean; projectId: string; onClose: () => void; onCreated: (task: BrainTask) => Promise<void> }) {
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<BrainTaskType>("feature");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => createBrainTask(projectId, { title, type, description, motivation: "" }),
    onSuccess: onCreated,
    onError: (mutationError) => setError(getErrorMessage(mutationError))
  });

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nuovo task engineering</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField autoFocus label="Titolo" value={title} onChange={(event) => setTitle(event.target.value)} />
          <FormControl>
            <InputLabel id="task-type-label">Tipo</InputLabel>
            <Select labelId="task-type-label" label="Tipo" value={type} onChange={(event) => setType(event.target.value as BrainTaskType)}>
              {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Descrizione" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={4} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Annulla</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !title.trim() || !description.trim()}>
          {mutation.isPending ? "Creazione" : "Crea task"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function statusLabel(status: BrainTaskStatus): string {
  const labels: Record<BrainTaskStatus, string> = {
    definition: "Definizione",
    requirements: "Requisiti",
    design: "Design",
    breakdown: "Piano",
    implementation: "Implementazione",
    done: "Completato"
  };
  return labels[status];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
