import AddIcon from "@mui/icons-material/Add";
import { Box, Button, Chip, CircularProgress, Divider, List, ListItemButton, ListItemText, Paper, Stack, Typography } from "@mui/material";
import type { WorkflowDefinition, WorkflowRun } from "../../types/workflows";

type AutomationWorkflowListProps = {
  workflows: WorkflowDefinition[];
  runs: WorkflowRun[];
  selectedWorkflowId: string | null;
  loading: boolean;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateWorkflow: () => void;
};

export function AutomationWorkflowList({
  workflows,
  runs,
  selectedWorkflowId,
  loading,
  onSelectWorkflow,
  onCreateWorkflow
}: AutomationWorkflowListProps) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", position: { xl: "sticky" }, top: { xl: 92 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.25 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={800}>Workflow</Typography>
          <Typography variant="caption" color="text.secondary">{workflows.length} automazioni</Typography>
        </Box>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onCreateWorkflow}>Nuovo</Button>
      </Stack>
      <Divider />
      {loading ? (
        <Box sx={{ minHeight: 180, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : workflows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nessun workflow</Typography>
      ) : (
        <List disablePadding sx={{ maxHeight: { xl: "calc(100dvh - 240px)" }, overflowY: "auto" }}>
          {workflows.map((workflow) => {
            const lastRun = runs.find((run) => run.workflowId === workflow.id);

            return (
              <ListItemButton
                key={workflow.id}
                selected={workflow.id === selectedWorkflowId}
                onClick={() => onSelectWorkflow(workflow.id)}
                sx={{ alignItems: "flex-start", py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
              >
                <ListItemText
                  primary={workflow.name}
                  secondary={
                    <Stack component="span" direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.75 }}>
                      <Chip component="span" size="small" label={`${workflow.nodes.length} nodi`} />
                      {lastRun ? (
                        <Chip
                          component="span"
                          size="small"
                          variant="outlined"
                          color={lastRun.status === "success" ? "success" : "error"}
                          label={lastRun.status === "success" ? "Riuscita" : "Fallita"}
                        />
                      ) : null}
                    </Stack>
                  }
                  primaryTypographyProps={{ variant: "body2", fontWeight: 750, noWrap: true }}
                  secondaryTypographyProps={{ component: "div" }}
                />
                <Box
                  aria-label={workflow.active ? "Workflow attivo" : "Workflow inattivo"}
                  sx={{
                    width: 8,
                    height: 8,
                    mt: 0.6,
                    ml: 0.75,
                    flexShrink: 0,
                    borderRadius: "50%",
                    bgcolor: workflow.active ? "success.main" : "action.disabled"
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Paper>
  );
}
