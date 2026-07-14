import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import React from "react";
import { createBrainTask } from "../../api/brain";
import type { BrainTask, BrainTaskType } from "../../types/brain";
import type { ProjectSummary } from "../../types/projects";
import { MAX_CONTEXT_REPOSITORIES, TASK_TYPE_LABELS } from "./taskEngineeringConfig";
import { getTaskErrorMessage } from "./taskEngineeringUtils";

type CreateTaskDialogProps = {
  open: boolean;
  projectId: string;
  projects: ProjectSummary[];
  onClose: () => void;
  onCreated: (task: BrainTask) => Promise<void>;
};

export function CreateTaskDialog({
  open,
  projectId,
  projects,
  onClose,
  onCreated
}: CreateTaskDialogProps) {
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<BrainTaskType>("feature");
  const [description, setDescription] = React.useState("");
  const [contextProjectIds, setContextProjectIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const contextProjects = projects.filter((project) => project.id !== projectId);
  const selectedContextProjects = contextProjects.filter((project) => contextProjectIds.includes(project.id));
  const mutation = useMutation({
    mutationFn: () => createBrainTask(projectId, {
      title,
      type,
      description,
      motivation: "",
      contextProjectIds
    }),
    onSuccess: onCreated,
    onError: (mutationError) => setError(getTaskErrorMessage(mutationError))
  });

  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setType("feature");
      setDescription("");
      setContextProjectIds([]);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Nuovo task engineering</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField autoFocus label="Titolo" value={title} onChange={(event) => setTitle(event.target.value)} />
          <FormControl>
            <InputLabel id="task-type-label">Tipo</InputLabel>
            <Select
              labelId="task-type-label"
              label="Tipo"
              value={type}
              onChange={(event) => setType(event.target.value as BrainTaskType)}
            >
              {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Descrizione"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={4}
          />
          <Autocomplete
            multiple
            disableCloseOnSelect
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
                label="Repository di contesto"
                helperText={`${contextProjectIds.length}/${MAX_CONTEXT_REPOSITORIES}`}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>Annulla</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !title.trim() || !description.trim()}
        >
          {mutation.isPending ? "Creazione" : "Crea task"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
