import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { approveBrainTask, updateBrainTask } from "../../api/brain";
import type { BrainContentPhase, BrainGatePhase, BrainTask } from "../../types/brain";
import type { ProjectSummary } from "../../types/projects";
import { ImplementationPanel } from "./ImplementationPanel";
import {
  MAX_CONTEXT_REPOSITORIES,
  TASK_PHASES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER
} from "./taskEngineeringConfig";
import {
  formatTaskDate,
  getContextProjectIds,
  getTaskErrorMessage,
  haveSameProjectIds
} from "./taskEngineeringUtils";

type TaskWorkbenchProps = {
  projectId: string;
  projects: ProjectSummary[];
  task: BrainTask;
  onChanged: () => Promise<void>;
};

export function TaskWorkbench({ projectId, projects, task, onChanged }: TaskWorkbenchProps) {
  const [phase, setPhase] = React.useState<BrainGatePhase>(
    task.status === "done" ? "implementation" : task.status
  );
  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.definition.description);
  const [motivation, setMotivation] = React.useState(task.definition.motivation);
  const [content, setContent] = React.useState(
    phase === "definition" || phase === "implementation" ? "" : task[phase].content
  );
  const [contextProjectIds, setContextProjectIds] = React.useState(() =>
    getContextProjectIds(projects, task.contextRepositoryPaths)
  );
  const [error, setError] = React.useState<string | null>(null);
  const contextProjects = projects.filter((project) => project.id !== projectId);
  const selectedContextProjects = contextProjects.filter((project) => contextProjectIds.includes(project.id));
  const savedContextProjectIds = getContextProjectIds(projects, task.contextRepositoryPaths);
  const contextChanged = !haveSameProjectIds(contextProjectIds, savedContextProjectIds);
  const primaryProject = projects.find((project) => project.id === projectId);

  React.useEffect(() => {
    if (phase !== "definition" && phase !== "implementation") {
      setContent(task[phase].content);
    }
  }, [phase, task]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (phase === "definition") {
        return updateBrainTask(projectId, task.id, {
          title,
          definition: { description, motivation }
        });
      }
      if (phase === "implementation") return task;
      return updateBrainTask(projectId, task.id, {
        phase: phase as BrainContentPhase,
        content
      });
    },
    onSuccess: onChanged,
    onError: (mutationError) => setError(getTaskErrorMessage(mutationError))
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
    onError: (mutationError) => setError(getTaskErrorMessage(mutationError))
  });
  const contextMutation = useMutation({
    mutationFn: () => updateBrainTask(projectId, task.id, { contextProjectIds }),
    onSuccess: async () => {
      setError(null);
      await onChanged();
    },
    onError: (mutationError) => setError(getTaskErrorMessage(mutationError))
  });

  const currentPhaseIndex = TASK_STATUS_ORDER.indexOf(task.status);
  const busy = saveMutation.isPending || approveMutation.isPending || contextMutation.isPending;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", minWidth: 0 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" sx={{ p: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" noWrap>{task.title}</Typography>
          <Typography variant="caption" color="text.secondary">
            Aggiornato {formatTaskDate(task.updatedAt)}
          </Typography>
        </Box>
        <Chip
          color={task.status === "done" ? "success" : "primary"}
          variant="outlined"
          label={TASK_STATUS_LABELS[task.status]}
        />
      </Stack>
      <Divider />
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        alignItems={{ md: "center" }}
        sx={{ px: 2, py: 1.5, bgcolor: "action.hover" }}
      >
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: { md: 180 } }}>
          <Chip size="small" color="primary" label="Principale" />
          <Typography variant="body2" fontWeight={750} noWrap>
            {primaryProject?.name ?? projectId}
          </Typography>
        </Stack>
        <Autocomplete
          multiple
          disableCloseOnSelect
          limitTags={3}
          options={contextProjects}
          value={selectedContextProjects}
          getOptionLabel={(project) => project.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          getOptionDisabled={(project) =>
            contextProjectIds.length >= MAX_CONTEXT_REPOSITORIES && !contextProjectIds.includes(project.id)
          }
          onChange={(_, nextProjects) => setContextProjectIds(nextProjects.map((project) => project.id))}
          renderOption={(props, project, { selected }) => (
            <li {...props}>
              <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
              <ListItemText
                primary={project.name}
                secondary={`${project.branch} · ${project.isClean ? "Pulito" : "Modificato"}`}
              />
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              label="Repository di contesto"
              helperText={`${contextProjectIds.length}/${MAX_CONTEXT_REPOSITORIES}`}
            />
          )}
          sx={{ minWidth: 0, flex: 1 }}
        />
        <Button
          variant="outlined"
          startIcon={contextMutation.isPending ? <CircularProgress size={16} /> : <SaveOutlinedIcon />}
          onClick={() => contextMutation.mutate()}
          disabled={!contextChanged || busy}
          sx={{ flexShrink: 0 }}
        >
          Salva contesto
        </Button>
      </Stack>
      <Divider />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "196px minmax(0, 1fr)" }, minWidth: 0 }}>
        <Box
          component="nav"
          aria-label="Gate del task"
          sx={{
            p: 1,
            bgcolor: "var(--rc-surface-1)",
            borderRight: { md: "1px solid" },
            borderBottom: { xs: "1px solid", md: 0 },
            borderColor: "divider",
            overflowX: { xs: "auto", md: "visible" }
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ display: { xs: "none", md: "block" }, px: 1, mb: 0.75 }}>
            Gate del task
          </Typography>
          <Stack direction={{ xs: "row", md: "column" }} spacing={0.5} sx={{ minWidth: { xs: 680, md: 0 } }}>
            {TASK_PHASES.map((item, index) => {
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
                  startIcon={approved ? <CheckCircleOutlineIcon fontSize="small" /> : (
                    <Box
                      component="span"
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid currentColor",
                        fontFamily: "var(--rc-font-mono)",
                        fontSize: 10
                      }}
                    >
                      {index + 1}
                    </Box>
                  )}
                  sx={{
                    minWidth: { xs: 124, md: 0 },
                    justifyContent: "flex-start",
                    px: 1.25,
                    opacity: unlocked ? 1 : 0.55
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ px: { xs: 1.5, md: 2.5 }, pt: { xs: 1.5, md: 2.25 }, pb: 1.25 }}>
            <Typography variant="overline" color="primary.main">
              {phase === "implementation" ? "Esecuzione controllata" : "Contenuto modificabile · approvazione umana"}
            </Typography>
            <Typography variant="h3">{TASK_PHASES.find((item) => item.id === phase)?.label}</Typography>
          </Box>
          <Divider />
          <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
            {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
            {phase === "definition" ? (
              <Stack spacing={2}>
                <TextField label="Titolo" value={title} onChange={(event) => setTitle(event.target.value)} fullWidth />
                <TextField
                  label="Descrizione"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  multiline
                  minRows={5}
                  fullWidth
                />
                <TextField
                  label="Motivazione"
                  value={motivation}
                  onChange={(event) => setMotivation(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                />
              </Stack>
            ) : phase === "implementation" ? (
              <ImplementationPanel projectId={projectId} task={task} onChanged={onChanged} />
            ) : (
              <TextField
                label={TASK_PHASES.find((item) => item.id === phase)?.label}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                multiline
                minRows={14}
                fullWidth
                inputProps={{ style: { fontFamily: "var(--rc-font-mono)", fontSize: 13.5, lineHeight: 1.55 } }}
              />
            )}
          </Box>

          {phase !== "implementation" ? (
            <Stack
              direction={{ xs: "column-reverse", sm: "row" }}
              justifyContent="flex-end"
              spacing={1}
              sx={{ px: { xs: 1.5, md: 2.5 }, py: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-1)" }}
            >
              <Button variant="outlined" onClick={() => saveMutation.mutate()} disabled={busy}>Salva bozza</Button>
              <Button
                variant="contained"
                onClick={() => approveMutation.mutate()}
                disabled={busy}
                startIcon={busy ? <CircularProgress size={16} /> : <CheckCircleOutlineIcon />}
              >
                Approva gate e continua
              </Button>
            </Stack>
          ) : task.status === "implementation" ? (
            <Stack alignItems="flex-end" sx={{ px: { xs: 1.5, md: 2.5 }, py: 1.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "var(--rc-surface-1)" }}>
              <Button
                variant="contained"
                color="success"
                onClick={() => approveMutation.mutate()}
                disabled={busy}
                startIcon={<CheckCircleOutlineIcon />}
              >
                Chiudi task
              </Button>
            </Stack>
          ) : null}
        </Box>
      </Box>
    </Paper>
  );
}
