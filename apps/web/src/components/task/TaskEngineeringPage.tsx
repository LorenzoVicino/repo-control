import AddIcon from "@mui/icons-material/Add";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { fetchBrainTasks } from "../../api/brain";
import type { BrainTaskStatus } from "../../types/brain";
import type { ProjectSummary } from "../../types/projects";
import { TaskList } from "./TaskList";
import { TaskPlanningComposer } from "./TaskPlanningComposer";
import { TaskWorkbench } from "./TaskWorkbench";

type TaskEngineeringPageProps = {
  projects: ProjectSummary[];
};

type ComposerStage = "intent" | "planning" | "review";

export function TaskEngineeringPage({ projects }: TaskEngineeringPageProps) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [composerStage, setComposerStage] = React.useState<ComposerStage>("intent");

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
  const tasks = React.useMemo(
    () => tasksQuery.data?.tasks ?? [],
    [tasksQuery.data?.tasks]
  );

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
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ md: "flex-end" }}
      >
        <Box>
          <Typography variant="overline" color="primary.light" component="div">AI workbench</Typography>
          <Typography component="h1" variant="h1">Task engineering</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
            Dall’intento alle verifiche, con approvazioni esplicite e il repository come fonte di verità.
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
                setCreating(false);
                setComposerStage("intent");
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
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              setComposerStage("intent");
              setCreating(true);
            }}
            disabled={!projectId || creating}
          >
            Nuovo task
          </Button>
        </Stack>
      </Stack>

      {tasksQuery.error instanceof Error ? <Alert severity="error">{tasksQuery.error.message}</Alert> : null}

      <TaskFlow status={creating || !selectedTask ? null : selectedTask.status} composerStage={composerStage} />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "280px minmax(0, 1fr)" },
          gap: 1.5,
          alignItems: "start"
        }}
      >
        <Box sx={{ display: { xs: creating || tasks.length === 0 ? "none" : "block", lg: "block" } }}>
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            loading={tasksQuery.isLoading}
            onSelect={(taskId) => {
              setSelectedTaskId(taskId);
              setCreating(false);
              setComposerStage("intent");
            }}
          />
        </Box>
        {creating || (!selectedTask && !tasksQuery.isLoading) ? (
          <TaskPlanningComposer
            key={projectId}
            projectId={projectId}
            projects={projects}
            canCancel={Boolean(selectedTask)}
            onStageChange={setComposerStage}
            onCancel={() => {
              setCreating(false);
              setComposerStage("intent");
            }}
            onCreated={async (task) => {
              await refreshTasks();
              setSelectedTaskId(task.id);
              setCreating(false);
              setComposerStage("intent");
            }}
          />
        ) : selectedTask ? (
          <TaskWorkbench
            key={`${selectedTask.id}:${selectedTask.updatedAt}`}
            projectId={projectId}
            projects={projects}
            task={selectedTask}
            onChanged={refreshTasks}
          />
        ) : (
          <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center", p: 3, bgcolor: "var(--rc-surface-1)" }}>
            <CircularProgress size={26} />
          </Paper>
        )}
      </Box>
    </Stack>
  );
}

const TASK_FLOW_STEPS = ["Intento", "Piano", "Review", "Gate", "Implementazione", "Verifiche"] as const;

function TaskFlow({ status, composerStage }: { status: BrainTaskStatus | null; composerStage: ComposerStage }) {
  const activeIndex = status === null ? getComposerFlowIndex(composerStage) : getTaskFlowIndex(status);

  return (
    <Box
      component="nav"
      aria-label="Flusso Task engineering"
      sx={{
        overflowX: "auto",
        border: "1px solid var(--rc-border)",
        borderRadius: "var(--rc-radius-panel)",
        bgcolor: "var(--rc-surface-1)",
        scrollbarWidth: "thin"
      }}
    >
      <Stack direction="row" sx={{ minWidth: 650 }}>
        {TASK_FLOW_STEPS.map((label, index) => {
          const completed = index < activeIndex;
          const active = index === activeIndex;
          return (
            <Stack
              key={label}
              direction="row"
              alignItems="center"
              spacing={0.75}
              aria-current={active ? "step" : undefined}
              sx={{
                position: "relative",
                minHeight: 38,
                flex: 1,
                px: 1.25,
                color: active ? "text.primary" : completed ? "success.main" : "text.disabled",
                bgcolor: active ? "var(--rc-accent-tint)" : "transparent",
                borderRight: index < TASK_FLOW_STEPS.length - 1 ? "1px solid var(--rc-border)" : 0,
                "&::after": {
                  content: '""',
                  position: "absolute",
                  left: 10,
                  right: 10,
                  bottom: 0,
                  height: 2,
                  bgcolor: active ? "primary.main" : "transparent"
                }
              }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 17,
                  height: 17,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid currentColor",
                  borderRadius: "50%",
                  fontFamily: "var(--rc-font-mono)",
                  fontSize: 9
                }}
              >
                {completed ? <CheckRoundedIcon sx={{ fontSize: 12 }} /> : index + 1}
              </Box>
              <Typography sx={{ fontSize: 10.5, fontWeight: active ? 600 : 500, whiteSpace: "nowrap" }}>
                {label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function getTaskFlowIndex(status: BrainTaskStatus | null): number {
  if (status === null) return 0;
  if (status === "definition" || status === "requirements" || status === "design" || status === "breakdown") return 3;
  if (status === "implementation") return 4;
  return 5;
}

function getComposerFlowIndex(stage: ComposerStage): number {
  if (stage === "planning") return 1;
  if (stage === "review") return 2;
  return 0;
}
