import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import DifferenceOutlinedIcon from "@mui/icons-material/DifferenceOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import { alpha, Box, Paper, Stack, Typography } from "@mui/material";
import React from "react";
import type { DashboardSnapshot } from "./dashboardSnapshot";

type DashboardMetricsProps = {
  snapshot: DashboardSnapshot;
};

export function DashboardMetrics({ snapshot }: DashboardMetricsProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr 1fr",
          md: `repeat(${snapshot.dockerAvailable ? 4 : 3}, minmax(0, 1fr))`
        },
        gap: { xs: 1, md: 1.25 }
      }}
    >
      <MetricTile
        label="Repository"
        value={snapshot.total}
        detail={`${snapshot.favorite} preferiti`}
        icon={<AccountTreeOutlinedIcon />}
        color="#2563eb"
      />
      <MetricTile
        label="Pronti al lavoro"
        value={snapshot.healthy}
        detail={`${snapshot.healthPercentage}% del workspace`}
        icon={<CheckCircleOutlineRoundedIcon />}
        color="#059669"
      />
      <MetricTile
        label="Modifiche locali"
        value={snapshot.localChanges}
        detail={`${snapshot.dirty} repository coinvolti`}
        icon={<DifferenceOutlinedIcon />}
        color="#d97706"
      />
      {snapshot.dockerAvailable ? (
        <MetricTile
          label="Container attivi"
          value={snapshot.runningContainers}
          detail={`${snapshot.dockerGroups} gruppi runtime`}
          icon={<DnsOutlinedIcon />}
          color="#e11d48"
        />
      ) : null}
    </Box>
  );
}

type MetricTileProps = {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  color: string;
};

function MetricTile({ label, value, detail, icon, color }: MetricTileProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.25, sm: 1.5 },
        minHeight: 82,
        display: "flex",
        alignItems: "center",
        bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.94 : 0.88),
        borderColor: "divider",
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: alpha(color, 0.4),
          boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "light" ? 0.045 : 0.15)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
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
          <Typography sx={{ mt: 0.15, fontSize: "1.3rem", fontWeight: 750, lineHeight: 1.05 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.2 }}>
            {detail}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
