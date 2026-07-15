import { keyframes } from "@emotion/react";
import { alpha, Box } from "@mui/material";

const travelRight = keyframes`
  0% { transform: translate3d(-8px, 0, 0); opacity: 0; }
  12% { opacity: 1; }
  82% { opacity: 1; }
  100% { transform: translate3d(280px, 0, 0); opacity: 0; }
`;

const travelDown = keyframes`
  0% { transform: translate3d(0, -8px, 0); opacity: 0; }
  12% { opacity: 1; }
  82% { opacity: 1; }
  100% { transform: translate3d(0, 220px, 0); opacity: 0; }
`;

const pulseBracket = keyframes`
  0%, 100% { opacity: 0.18; transform: scale(0.96); }
  50% { opacity: 0.5; transform: scale(1); }
`;

export function DashboardMotionBackdrop() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: { xs: -12, md: -24 },
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none"
      }}
    >
      <Track direction="horizontal" top="8%" left="4%" length={300} tone="primary.main" delay="-1s" />
      <Track direction="horizontal" top="47%" right="2%" length={300} tone="success.main" delay="-4s" />
      <Track direction="horizontal" top="84%" left="22%" length={300} tone="warning.main" delay="-7s" />
      <Track direction="vertical" top="15%" left="18%" length={240} tone="secondary.main" delay="-2.5s" />
      <Track direction="vertical" top="56%" right="15%" length={240} tone="error.main" delay="-6s" />

      <Box
        sx={(theme) => ({
          position: "absolute",
          top: "22%",
          right: "6%",
          width: 72,
          height: 54,
          borderTop: `1px solid ${alpha(theme.palette.secondary.main, 0.32)}`,
          borderRight: `1px solid ${alpha(theme.palette.secondary.main, 0.32)}`,
          animation: `${pulseBracket} 6s ease-in-out infinite`
        })}
      />
      <Box
        sx={(theme) => ({
          position: "absolute",
          bottom: "12%",
          left: "7%",
          width: 92,
          height: 64,
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
          borderLeft: `1px solid ${alpha(theme.palette.warning.main, 0.28)}`,
          animation: `${pulseBracket} 7.5s ease-in-out -3s infinite`
        })}
      />
    </Box>
  );
}

type TrackProps = {
  direction: "horizontal" | "vertical";
  top: string;
  left?: string;
  right?: string;
  length: number;
  tone: string;
  delay: string;
};

function Track({ direction, top, left, right, length, tone, delay }: TrackProps) {
  const isHorizontal = direction === "horizontal";

  return (
    <Box
      sx={(theme) => ({
        position: "absolute",
        top,
        left,
        right,
        width: isHorizontal ? length : "1px",
        height: isHorizontal ? "1px" : length,
        bgcolor: alpha(theme.palette.text.secondary, theme.palette.mode === "light" ? 0.16 : 0.2),
        "&::before": {
          content: '""',
          position: "absolute",
          top: isHorizontal ? -2 : 0,
          left: isHorizontal ? 0 : -2,
          width: 5,
          height: 5,
          bgcolor: tone,
          boxShadow: `0 0 0 3px ${alpha(theme.palette.background.default, 0.78)}`,
          animation: `${isHorizontal ? travelRight : travelDown} ${isHorizontal ? "8s" : "9s"} linear ${delay} infinite`
        }
      })}
    />
  );
}
