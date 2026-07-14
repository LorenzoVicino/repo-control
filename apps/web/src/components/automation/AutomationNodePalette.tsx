import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { alpha, Box, ButtonBase, Stack, Typography } from "@mui/material";
import type { WorkflowNodeType } from "../../types/workflows";
import {
  AUTOMATION_NODE_DEFINITIONS,
  AUTOMATION_NODE_GROUPS
} from "./automationNodeCatalog";

type AutomationNodePaletteProps = {
  nodeTypes: WorkflowNodeType[];
  onAddNode: (type: WorkflowNodeType) => void;
};

export function AutomationNodePalette({ nodeTypes, onAddNode }: AutomationNodePaletteProps) {
  return (
    <Box
      component="aside"
      aria-label="Libreria nodi"
      sx={{
        minWidth: 0,
        height: "100%",
        overflowY: "auto",
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper"
      }}
    >
      <Box sx={{ position: "sticky", top: 0, zIndex: 1, px: 1.5, py: 1.25, bgcolor: "background.paper" }}>
        <Typography variant="subtitle2" fontWeight={800}>Libreria nodi</Typography>
        <Typography variant="caption" color="text.secondary">{AUTOMATION_NODE_DEFINITIONS.length} azioni</Typography>
      </Box>
      {AUTOMATION_NODE_GROUPS.map((group) => (
        <Box key={group} sx={{ pb: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: "block", px: 1.5, py: 0.5 }}>
            {group}
          </Typography>
          <Stack spacing={0.35} sx={{ px: 0.75 }}>
            {AUTOMATION_NODE_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => {
              const Icon = definition.icon;
              const disabled = definition.type === "trigger.manual" && nodeTypes.includes("trigger.manual");

              return (
                <ButtonBase
                  key={definition.type}
                  disabled={disabled}
                  onClick={() => onAddNode(definition.type)}
                  sx={{
                    width: "100%",
                    minHeight: 46,
                    px: 1,
                    py: 0.75,
                    justifyContent: "flex-start",
                    borderRadius: 1,
                    textAlign: "left",
                    color: "text.primary",
                    "&:hover": { bgcolor: "action.hover" },
                    "&.Mui-disabled": { opacity: 0.4 }
                  }}
                >
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                      borderRadius: 1,
                      color: definition.color,
                      bgcolor: alpha(definition.color, 0.11)
                    }}
                  >
                    <Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, ml: 1, flexGrow: 1 }}>
                    <Typography variant="caption" component="div" fontWeight={750} noWrap>
                      {definition.label}
                    </Typography>
                    <Typography variant="caption" component="div" color="text.secondary" noWrap>
                      {definition.description}
                    </Typography>
                  </Box>
                  <AddRoundedIcon sx={{ ml: 0.5, fontSize: 17, color: "text.secondary" }} />
                </ButtonBase>
              );
            })}
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
