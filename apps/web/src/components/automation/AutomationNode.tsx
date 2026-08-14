import { alpha, Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import React from "react";
import type { WorkflowNode } from "../../types/workflows";
import { getAutomationNodeDefinition, getAutomationNodeSummary } from "./automationNodeCatalog";

export type AutomationFlowNode = Node<{ workflowNode: WorkflowNode }, "automation">;

export const AutomationNode = React.memo(function AutomationNode({
  data,
  selected
}: NodeProps<AutomationFlowNode>) {
  const theme = useTheme();
  const workflowNode = data.workflowNode;
  const definition = getAutomationNodeDefinition(workflowNode.type);
  const Icon = definition.icon;
  const handleStyle = {
    width: 12,
    height: 12,
    border: `3px solid ${theme.palette.background.paper}`,
    background: definition.color,
    boxShadow: `0 0 0 1px ${alpha(definition.color, 0.5)}`
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        width: 238,
        minHeight: 76,
        overflow: "visible",
        borderRadius: 2,
        borderColor: selected ? definition.color : "divider",
        borderWidth: selected ? 2 : 1,
        bgcolor: "background.paper",
        boxShadow: selected
          ? `0 0 0 4px ${alpha(definition.color, 0.12)}, 0 14px 32px ${alpha(theme.palette.common.black, 0.14)}`
          : `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.08 : 0.28)}`,
        transition: "border-color 150ms ease, box-shadow 150ms ease",
        "&:hover": {
          borderColor: selected ? definition.color : alpha(definition.color, 0.58)
        }
      }}
    >
      {workflowNode.type !== "trigger.manual" ? (
        <Handle type="target" position={Position.Left} style={handleStyle} />
      ) : null}
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 1.35, py: 1.2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: "1px solid",
            borderColor: alpha(definition.color, 0.3),
            borderRadius: 1.5,
            color: definition.color,
            bgcolor: alpha(definition.color, 0.1)
          }}
        >
          <Icon sx={{ fontSize: 21 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} lineHeight={1.25} noWrap>
            {workflowNode.name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            noWrap
            sx={{ mt: 0.35, maxWidth: 160 }}
          >
            {getAutomationNodeSummary(workflowNode)}
          </Typography>
        </Box>
      </Stack>
      {workflowNode.type !== "output.summary" ? (
        <Handle type="source" position={Position.Right} style={handleStyle} />
      ) : null}
    </Paper>
  );
});
