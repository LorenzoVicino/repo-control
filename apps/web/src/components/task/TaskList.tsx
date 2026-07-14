import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import type { BrainTask } from "../../types/brain";
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "./taskEngineeringConfig";

type TaskListProps = {
  tasks: BrainTask[];
  selectedTaskId: string | null;
  loading: boolean;
  onSelect: (taskId: string) => void;
};

export function TaskList({ tasks, selectedTaskId, loading, onSelect }: TaskListProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", position: { lg: "sticky" }, top: { lg: 92 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Task</Typography>
        <Chip size="small" variant="outlined" label={tasks.length} />
      </Stack>
      <Divider />
      {loading ? (
        <Box sx={{ minHeight: 180, display: "grid", placeItems: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Nessun task per questo repository.
        </Typography>
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
                    <Chip
                      component="span"
                      size="small"
                      color={task.status === "done" ? "success" : "primary"}
                      variant="outlined"
                      label={TASK_STATUS_LABELS[task.status]}
                    />
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
