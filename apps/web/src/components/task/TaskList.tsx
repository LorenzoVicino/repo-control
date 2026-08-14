import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
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
import { formatTaskDate } from "./taskEngineeringUtils";

type TaskListProps = {
  tasks: BrainTask[];
  selectedTaskId: string | null;
  loading: boolean;
  onSelect: (taskId: string) => void;
};

export function TaskList({ tasks, selectedTaskId, loading, onSelect }: TaskListProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ overflow: "hidden", position: { lg: "sticky" }, top: { lg: 92 }, bgcolor: "var(--rc-surface-1)" }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Box>
          <Typography variant="overline" color="text.disabled" component="div">Task rail</Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Lavoro del repository</Typography>
        </Box>
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
              sx={{
                position: "relative",
                alignItems: "flex-start",
                py: 1.25,
                pl: 1.75,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  left: 0,
                  top: 9,
                  bottom: 9,
                  width: 2.5,
                  borderRadius: "0 3px 3px 0",
                  bgcolor: task.id === selectedTaskId ? "primary.main" : "transparent"
                },
                "&.Mui-selected": { bgcolor: "var(--rc-accent-tint)" },
                "&.Mui-selected:hover": { bgcolor: "var(--rc-accent-tint)" }
              }}
            >
              <ListItemText
                primary={task.title}
                secondary={
                  <Stack component="span" spacing={0.65} sx={{ mt: 0.6 }}>
                    <Stack component="span" direction="row" spacing={0.65} alignItems="center">
                      <Typography component="span" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5, color: "text.disabled" }}>
                        {TASK_TYPE_LABELS[task.type]}
                      </Typography>
                      <Typography component="span" sx={{ fontSize: 9.5, color: "text.disabled" }}>·</Typography>
                      <Stack component="span" direction="row" spacing={0.35} alignItems="center" sx={{ color: task.planning.provider === "manual" ? "text.disabled" : "primary.light" }}>
                        {task.planning.provider !== "manual" ? <AutoAwesomeOutlinedIcon sx={{ fontSize: 11 }} /> : null}
                        <Typography component="span" sx={{ fontSize: 9.5 }}>
                          {task.planning.provider === "manual" ? "Manuale" : "Proposta AI"}
                        </Typography>
                      </Stack>
                    </Stack>
                    <Stack component="span" direction="row" spacing={0.6} alignItems="center">
                      <Box
                        component="span"
                        sx={{ width: 14, height: 14, display: "grid", placeItems: "center", borderRadius: "50%", color: task.status === "done" ? "success.main" : "primary.light", border: "1px solid currentColor" }}
                      >
                        {task.status === "done" ? <CheckRoundedIcon sx={{ fontSize: 10 }} /> : (
                          <Box component="span" sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: "currentColor" }} />
                        )}
                      </Box>
                      <Typography component="span" sx={{ color: "text.secondary", fontSize: 10.5 }}>
                        {TASK_STATUS_LABELS[task.status]}
                      </Typography>
                      <Typography component="span" sx={{ ml: "auto !important", color: "text.disabled", fontSize: 9.5 }}>
                        {formatTaskDate(task.updatedAt)}
                      </Typography>
                    </Stack>
                  </Stack>
                }
                primaryTypographyProps={{ variant: "body2", fontWeight: 500, noWrap: true }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Paper>
  );
}
