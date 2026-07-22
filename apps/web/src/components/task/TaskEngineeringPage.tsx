import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  Alert,
  Box,
  Button,
  Chip,
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
import type { ProjectSummary } from "../../types/projects";
import { TaskList } from "./TaskList";
import { TaskPlanningComposer } from "./TaskPlanningComposer";
import { TaskWorkbench } from "./TaskWorkbench";

type TaskEngineeringPageProps = {
  projects: ProjectSummary[];
};

export function TaskEngineeringPage({ projects }: TaskEngineeringPageProps) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

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
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ md: "flex-end" }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography component="h1" variant="h1">Task engineering</Typography>
            <Chip size="small" color="primary" variant="outlined" label="AI assisted" />
          </Stack>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>
            Dal brief al piano verificabile, con il repository come fonte di verità.
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
            onClick={() => setCreating(true)}
            disabled={!projectId || creating}
          >
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
        <Box sx={{ display: { xs: creating || tasks.length === 0 ? "none" : "block", lg: "block" } }}>
          <TaskList
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            loading={tasksQuery.isLoading}
            onSelect={(taskId) => {
              setSelectedTaskId(taskId);
              setCreating(false);
            }}
          />
        </Box>
        {creating || (!selectedTask && !tasksQuery.isLoading) ? (
          <TaskPlanningComposer
            key={projectId}
            projectId={projectId}
            projects={projects}
            canCancel={Boolean(selectedTask)}
            onCancel={() => setCreating(false)}
            onCreated={async (task) => {
              await refreshTasks();
              setSelectedTaskId(task.id);
              setCreating(false);
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
          <Paper variant="outlined" sx={{ minHeight: 420, display: "grid", placeItems: "center", p: 3 }}>
            <CircularProgress size={26} />
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
