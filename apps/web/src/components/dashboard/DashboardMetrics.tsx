import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Paper, Stack, Typography } from "@mui/material";
import React from "react";
import { getStats } from "../../utils/projects";

type DashboardMetricsProps = {
  stats: ReturnType<typeof getStats>;
};

export function DashboardMetrics({ stats }: DashboardMetricsProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr 1fr",
          md: "repeat(5, minmax(0, 1fr))"
        },
        gap: 1.5
      }}
    >
      <MetricTile label="Repos" value={stats.total} icon={<AccountTreeIcon />} color="#2563eb" />
      <MetricTile label="Puliti" value={stats.clean} icon={<CheckCircleIcon />} color="#2e7d32" />
      <MetricTile label="Da sistemare" value={stats.dirty} icon={<WarningAmberIcon />} color="#ed6c02" />
      <MetricTile label="Behind" value={stats.behind} icon={<SyncIcon />} color="#7b1fa2" />
      <MetricTile label="Compose" value={stats.compose} icon={<BuildIcon />} color="#00897b" />
    </Box>
  );
}

type MetricTileProps = {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
};

function MetricTile({ label, value, icon, color }: MetricTileProps) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minHeight: 86 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box sx={{ color, display: "grid", placeItems: "center" }}>{icon}</Box>
        <Box>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
