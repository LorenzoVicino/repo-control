import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SyncIcon from "@mui/icons-material/Sync";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { alpha, Box, Paper, Stack, Typography } from "@mui/material";
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
        gap: 1.25,
        "& > :last-child": {
          gridColumn: { xs: "1 / -1", md: "auto" }
        }
      }}
    >
      <MetricTile label="Repository" value={stats.total} icon={<AccountTreeIcon />} color="#2563eb" />
      <MetricTile label="Puliti" value={stats.clean} icon={<CheckCircleIcon />} color="#059669" />
      <MetricTile label="Da verificare" value={stats.dirty} icon={<WarningAmberIcon />} color="#d97706" />
      <MetricTile label="Da aggiornare" value={stats.behind} icon={<SyncIcon />} color="#e11d48" />
      <MetricTile label="Con Compose" value={stats.compose} icon={<BuildIcon />} color="#0ea5e9" />
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
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        minHeight: 88,
        display: "flex",
        alignItems: "center",
        borderColor: "divider",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: alpha(color, 0.4),
          boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.055 : 0.18)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            color,
            bgcolor: alpha(color, 0.1),
            borderRadius: 1.5,
            "& svg": { fontSize: 20 }
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" component="div">
            {label}
          </Typography>
          <Typography sx={{ mt: 0.2, fontSize: "1.35rem", fontWeight: 750, lineHeight: 1.05 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
