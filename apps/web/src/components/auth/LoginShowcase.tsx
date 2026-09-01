import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import { alpha, Box, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

// Percentages of the artwork box, so the diagram scales with the column instead of needing
// breakpoints of its own. The order is the ring order: consecutive nodes are neighbours.
const CENTER = { x: 50, y: 50 };

const NODES: ReadonlyArray<{ id: string; x: number; y: number; icon: ReactElement }> = [
  { id: "repositories", x: 27, y: 15, icon: <AccountTreeOutlinedIcon /> },
  { id: "docker", x: 73, y: 15, icon: <StorageOutlinedIcon /> },
  { id: "automations", x: 90, y: 62, icon: <HubOutlinedIcon /> },
  { id: "agents", x: 50, y: 91, icon: <SmartToyOutlinedIcon /> },
  { id: "terminal", x: 10, y: 62, icon: <TerminalOutlinedIcon /> }
];

const RING_EDGES = NODES.map((node, index) => ({
  from: node,
  to: NODES[(index + 1) % NODES.length]
}));

export function LoginShowcase() {
  const { t } = useTranslation();

  return (
    <Stack spacing={{ xs: 3, xl: 4 }} sx={{ maxWidth: 520, mx: "auto", width: "100%" }}>
      <Box>
        <Typography component="h2" variant="h5" sx={{ maxWidth: 420, fontSize: { lg: 27, xl: 30 } }}>
          {t("auth.showcase.headline")}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.25, maxWidth: 420, fontSize: 13, lineHeight: 1.65 }}>
          {t("auth.showcase.description")}
        </Typography>
      </Box>

      <Box
        role="img"
        aria-label={t("auth.showcase.artworkLabel")}
        sx={{ position: "relative", width: "100%", maxWidth: 460, aspectRatio: "1.12 / 1" }}
      >
        <Box
          aria-hidden="true"
          component="svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          sx={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* The ring reads as the workspace boundary, the spokes as the surfaces that share
              the selected repository. Strokes keep their width under the non-uniform scale. */}
          {RING_EDGES.map((edge) => (
            <line
              key={`ring-${edge.from.id}`}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="var(--rc-border-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {NODES.map((node) => (
            <line
              key={`spoke-${node.id}`}
              x1={CENTER.x}
              y1={CENTER.y}
              x2={node.x}
              y2={node.y}
              stroke="var(--rc-border-strong)"
              strokeWidth={1}
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </Box>

        {[...RING_EDGES.map((edge) => ({
          key: `ring-dot-${edge.from.id}`,
          x: (edge.from.x + edge.to.x) / 2,
          y: (edge.from.y + edge.to.y) / 2
        })), ...NODES.map((node) => ({
          key: `spoke-dot-${node.id}`,
          x: (CENTER.x + node.x) / 2,
          y: (CENTER.y + node.y) / 2
        }))].map((dot) => (
          <Box
            key={dot.key}
            aria-hidden="true"
            sx={{
              position: "absolute",
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: 5,
              height: 5,
              borderRadius: "50%",
              bgcolor: "primary.main",
              opacity: 0.55,
              transform: "translate(-50%, -50%)"
            }}
          />
        ))}

        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `${CENTER.x}%`,
            top: `${CENTER.y}%`,
            width: 190,
            height: 190,
            borderRadius: "50%",
            transform: "translate(-50%, -50%)",
            background: (theme) =>
              `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.16)}, transparent 68%)`
          }}
        />

        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            left: `${CENTER.x}%`,
            top: `${CENTER.y}%`,
            width: 74,
            height: 74,
            display: "grid",
            placeItems: "center",
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.45),
            borderRadius: "50%",
            color: "primary.main",
            bgcolor: "background.paper",
            transform: "translate(-50%, -50%)"
          }}
        >
          <RepoControlMark size={40} />
        </Box>

        {NODES.map((node) => (
          <Box
            key={node.id}
            aria-hidden="true"
            sx={{
              position: "absolute",
              left: `${node.x}%`,
              top: `${node.y}%`,
              width: 46,
              height: 46,
              display: "grid",
              placeItems: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "var(--rc-radius-control)",
              color: "primary.light",
              bgcolor: "var(--rc-surface-2)",
              transform: "translate(-50%, -50%)",
              "& .MuiSvgIcon-root": { fontSize: 21 }
            }}
          >
            {node.icon}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

// The mark from apps/web/public/icon/repo-control-mark.svg, inlined so it can take the
// palette's accent colour instead of the fixed one baked into the file.
export function RepoControlMark({ size }: { size: number }) {
  return (
    <Box
      aria-hidden="true"
      component="svg"
      viewBox="0 0 512 512"
      sx={{ width: size, height: size, display: "block", color: "inherit" }}
    >
      <g fill="none" stroke="currentColor" strokeWidth={22} strokeLinecap="round">
        <path d="M300 107.6 A150 150 0 0 1 402.2 284.6" />
        <path d="M358.2 360.8 A150 150 0 0 1 153.8 360.8" />
        <path d="M109.8 284.6 A150 150 0 0 1 212 107.6" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth={18} strokeLinecap="round">
        <path d="M256 251 L256 101" />
        <path d="M256 251 L385.9 326" />
        <path d="M256 251 L126.1 326" />
      </g>
      <g fill="currentColor">
        <circle cx={256} cy={101} r={31} />
        <circle cx={385.9} cy={326} r={31} />
        <circle cx={126.1} cy={326} r={31} />
        <circle cx={256} cy={251} r={44} />
      </g>
    </Box>
  );
}
