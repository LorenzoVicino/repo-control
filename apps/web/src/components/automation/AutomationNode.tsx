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
    width: 10,
    height: 10,
    border: `2px solid ${theme.palette.background.paper}`,
    background: definition.color
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        width: 220,
        minHeight: 88,
        overflow: "visible",
        borderRadius: 1,
        borderColor: selected ? definition.color : "divider",
        borderWidth: selected ? 2 : 1,
        bgcolor: "background.paper",
        boxShadow: selected
          ? `0 0 0 3px ${alpha(definition.color, 0.13)}, 0 12px 26px ${alpha(theme.palette.common.black, 0.1)}`
          : `0 7px 18px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.06 : 0.24)}`,
        transition: "border-color 140ms ease, box-shadow 140ms ease"
      }}
    >
      {workflowNode.type !== "trigger.manual" ? (
        <Handle type="target" position={Position.Left} style={handleStyle} />
      ) : null}
      <Box sx={{ height: 4, bgcolor: definition.color, borderRadius: "3px 3px 0 0" }} />
      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ px: 1.25, py: 1.15 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            borderRadius: 1,
            color: definition.color,
            bgcolor: alpha(definition.color, 0.11)
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={800} noWrap>
            {workflowNode.name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            component="div"
            noWrap
            sx={{ mt: 0.15, maxWidth: 152 }}
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
