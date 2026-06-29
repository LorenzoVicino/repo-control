import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { alpha, Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import type { CommandResult } from "../../types";

type CommandOutputProps = {
  result: CommandResult;
};

export function CommandOutput({ result }: CommandOutputProps) {
  const theme = useTheme();
  const statusColor = result.ok ? theme.palette.success.main : theme.palette.warning.main;

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ p: 1.25, bgcolor: alpha(statusColor, theme.palette.mode === "light" ? 0.12 : 0.2) }}
      >
        {result.ok ? (
          <CheckCircleIcon color="success" fontSize="small" />
        ) : (
          <WarningAmberIcon color="warning" fontSize="small" />
        )}
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {result.command}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            exit {result.exitCode ?? "n/a"} - {result.durationMs}ms
          </Typography>
        </Box>
      </Stack>
      {result.output ? (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            maxHeight: 280,
            overflow: "auto",
            bgcolor: theme.palette.mode === "light" ? "#0f172a" : "#05070a",
            color: "#e5e7eb",
            fontSize: 12,
            whiteSpace: "pre-wrap"
          }}
        >
          {result.output}
        </Box>
      ) : (
        <Box sx={{ p: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Done
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
