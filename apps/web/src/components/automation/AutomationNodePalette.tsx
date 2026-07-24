import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  alpha,
  Box,
  ButtonBase,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Typography
} from "@mui/material";
import React from "react";
import type { WorkflowNodeType } from "../../types/workflows";
import {
  AUTOMATION_NODE_DEFINITIONS,
  AUTOMATION_NODE_GROUPS
} from "./automationNodeCatalog";

type AutomationNodePaletteProps = {
  nodeTypes: WorkflowNodeType[];
  onAddNode: (type: WorkflowNodeType) => void;
  onClose?: () => void;
};

export function AutomationNodePalette({ nodeTypes, onAddNode, onClose }: AutomationNodePaletteProps) {
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("it");
  const filteredDefinitions = AUTOMATION_NODE_DEFINITIONS.filter((definition) =>
    normalizedQuery.length === 0
      || `${definition.label} ${definition.description} ${definition.group}`
        .toLocaleLowerCase("it")
        .includes(normalizedQuery)
  );

  return (
    <Box
      component="aside"
      aria-label="Libreria nodi"
      sx={{
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.paper",
        color: "text.primary"
      }}
    >
      <Box sx={{ px: 2, pt: 1.75, pb: 1.5 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Box>
            <Typography variant="subtitle1" fontWeight={850}>Cosa vuoi aggiungere?</Typography>
            <Typography variant="caption" color="text.secondary">
              {AUTOMATION_NODE_DEFINITIONS.length} passaggi disponibili
            </Typography>
          </Box>
          {onClose ? (
            <IconButton size="small" aria-label="Chiudi libreria nodi" onClick={onClose}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          ) : null}
        </Stack>
        <Box
          sx={{
            mt: 1.5,
            minHeight: 40,
            px: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            bgcolor: "background.default",
            "&:focus-within": {
              borderColor: "primary.main",
              boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}`
            }
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 19, color: "text.secondary" }} />
          <InputBase
            autoFocus
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca un passaggio..."
            inputProps={{ "aria-label": "Cerca nella libreria nodi" }}
            sx={{ fontSize: "0.875rem" }}
          />
        </Box>
      </Box>
      <Divider />
      <Box sx={{ minHeight: 0, flexGrow: 1, overflowY: "auto", px: 1, py: 1 }}>
        {filteredDefinitions.length === 0 ? (
          <Box sx={{ px: 2, py: 5, textAlign: "center" }}>
            <Typography variant="body2" fontWeight={750}>Nessun passaggio trovato</Typography>
            <Typography variant="caption" color="text.secondary">
              Prova con “Git”, “Docker” o “input”.
            </Typography>
          </Box>
        ) : AUTOMATION_NODE_GROUPS.map((group) => {
          const definitions = filteredDefinitions.filter((definition) => definition.group === group);
          if (definitions.length === 0) return null;

          return (
            <Box key={group} sx={{ pb: 1.25 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", px: 1, py: 0.5, letterSpacing: "0.09em" }}
              >
                {group}
              </Typography>
              <Stack spacing={0.35}>
                {definitions.map((definition) => {
                  const Icon = definition.icon;
                  const disabled = definition.type === "trigger.manual" && nodeTypes.includes("trigger.manual");

                  return (
                    <ButtonBase
                      key={definition.type}
                      disabled={disabled}
                      onClick={() => onAddNode(definition.type)}
                      sx={{
                        width: "100%",
                        minHeight: 54,
                        px: 1,
                        py: 0.75,
                        justifyContent: "flex-start",
                        border: "1px solid transparent",
                        borderRadius: 1.5,
                        textAlign: "left",
                        color: "text.primary",
                        transition: "background-color 140ms ease, border-color 140ms ease",
                        "&:hover": {
                          bgcolor: "action.hover",
                          borderColor: "divider"
                        },
                        "&:focus-visible": {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: -2
                        },
                        "&.Mui-disabled": { opacity: 0.42 }
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          border: "1px solid",
                          borderColor: alpha(definition.color, 0.28),
                          borderRadius: 1.25,
                          color: definition.color,
                          bgcolor: alpha(definition.color, 0.1)
                        }}
                      >
                        <Icon sx={{ fontSize: 19 }} />
                      </Box>
                      <Box sx={{ minWidth: 0, ml: 1.1, flexGrow: 1 }}>
                        <Typography variant="body2" component="div" fontWeight={750} noWrap>
                          {definition.label}
                        </Typography>
                        <Typography variant="caption" component="div" color="text.secondary" noWrap>
                          {definition.description}
                        </Typography>
                      </Box>
                      <AddRoundedIcon sx={{ ml: 0.5, fontSize: 18, color: "text.secondary" }} />
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
