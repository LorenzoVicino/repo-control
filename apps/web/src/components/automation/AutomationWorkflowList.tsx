import AddIcon from "@mui/icons-material/Add";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import type { WorkflowDefinition, WorkflowRun } from "../../types/workflows";
import {
  getWorkflowRunStatusColor,
  getWorkflowRunStatusLabelKey
} from "./workflowRunStatus";
import { validateWorkflow } from "./workflowValidation";

type AutomationWorkflowListProps = {
  embedded?: boolean;
  workflows: WorkflowDefinition[];
  runs: WorkflowRun[];
  selectedWorkflowId: string | null;
  loading: boolean;
  onSelectWorkflow: (workflowId: string) => void;
  onCreateWorkflow: () => void;
};

export function AutomationWorkflowList({
  embedded = false,
  workflows,
  runs,
  selectedWorkflowId,
  loading,
  onSelectWorkflow,
  onCreateWorkflow
}: AutomationWorkflowListProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = React.useState("");
  const language = i18n.language;
  const visibleWorkflows = workflows.filter((workflow) => {
    const searchableText = `${workflow.name} ${workflow.description}`.toLocaleLowerCase(language);
    return searchableText.includes(query.trim().toLocaleLowerCase(language));
  });

  return (
    <Paper
      variant={embedded ? undefined : "outlined"}
      square={embedded}
      sx={{
        overflow: "hidden",
        position: embedded ? "static" : { lg: "sticky" },
        top: embedded ? undefined : { lg: 92 }
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1.4 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={500}>{t("automation.yourWorkflows")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t("automation.workflowTotal", { total: workflows.length })}
          </Typography>
        </Box>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={onCreateWorkflow}>
          {t("automation.newWorkflow")}
        </Button>
      </Stack>
      <Divider />
      {workflows.length > 0 ? (
        <Box sx={{ p: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={query}
            placeholder={t("automation.searchWorkflows")}
            onChange={(event) => setQuery(event.target.value)}
            inputProps={{ "aria-label": t("automation.searchWorkflows") }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
        </Box>
      ) : null}
      {loading ? (
        <Box sx={{ minHeight: 180, display: "grid", placeItems: "center" }}><CircularProgress size={24} /></Box>
      ) : workflows.length === 0 ? (
        <Stack spacing={0.5} sx={{ p: 2 }}>
          <Typography variant="body2" fontWeight={500}>{t("automation.noWorkflows")}</Typography>
          <Typography variant="caption" color="text.secondary">{t("automation.noWorkflowsHint")}</Typography>
        </Stack>
      ) : visibleWorkflows.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          {t("automation.noSearchResults", { query })}
        </Typography>
      ) : (
        <List
          disablePadding
          sx={{
            maxHeight: embedded ? "calc(min(70dvh, 620px) - 132px)" : { lg: "calc(100dvh - 240px)" },
            overflowY: "auto"
          }}
        >
          {visibleWorkflows.map((workflow) => {
            const lastRun = runs.find((run) => run.workflowId === workflow.id);
            const validation = validateWorkflow(workflow.nodes, workflow.edges);

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
                      <Chip
                        component="span"
                        size="small"
                        label={t("automation.nodeTotal", { total: workflow.nodes.length })}
                      />
                      {lastRun ? (
                        <Chip
                          component="span"
                          size="small"
                          variant="outlined"
                          color={getWorkflowRunStatusColor(lastRun.status)}
                          label={t(`automation.runStatus.${getWorkflowRunStatusLabelKey(lastRun.status)}`)}
                        />
                      ) : null}
                    </Stack>
                  }
                  primaryTypographyProps={{ variant: "body2", fontWeight: 500, noWrap: true }}
                  secondaryTypographyProps={{ component: "div" }}
                />
                <Box
                  aria-label={validation.isRunnable
                    ? t("automation.workflowReady")
                    : t("automation.workflowIncomplete")}
                  sx={{
                    width: 8,
                    height: 8,
                    mt: 0.6,
                    ml: 0.75,
                    flexShrink: 0,
                    borderRadius: "50%",
                    bgcolor: validation.isRunnable ? "success.main" : "warning.main"
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
