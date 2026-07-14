import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import { alpha, Box, ButtonBase, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { DashboardSection } from "./DashboardSidebar";

type DashboardQuickActionsProps = {
  onNavigate: (section: DashboardSection) => void;
};

type ActionTone = "primary" | "info" | "success" | "warning";

type QuickAction = {
  title: string;
  description: string;
  destination: string;
  target: DashboardSection;
  tone: ActionTone;
  icon: ReactNode;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Lavora su un task",
    description: "Specifica, contesto e run",
    destination: "Task engineering",
    target: "tasks",
    tone: "primary",
    icon: <TaskAltOutlinedIcon />
  },
  {
    title: "Apri un repository",
    description: "Git, branch e terminale",
    destination: "Repository",
    target: "repositories",
    tone: "info",
    icon: <AccountTreeOutlinedIcon />
  },
  {
    title: "Controlla il runtime",
    description: "Container e servizi locali",
    destination: "Docker",
    target: "docker",
    tone: "success",
    icon: <StorageOutlinedIcon />
  },
  {
    title: "Riprendi un preferito",
    description: "Vai ai repository salvati",
    destination: "Preferiti",
    target: "favorites",
    tone: "warning",
    icon: <StarBorderRoundedIcon />
  }
];

export function DashboardQuickActions({ onNavigate }: DashboardQuickActionsProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "220px minmax(0, 1fr)" },
        columnGap: 4,
        alignItems: "start",
        flexShrink: 0
      }}
    >
      <Box sx={{ pt: { lg: 1.75 }, pb: { xs: 1.5, lg: 0 } }}>
        <Typography id="dashboard-home-title" component="h1" variant="h1">
          Cosa vuoi fare oggi?
        </Typography>
      </Box>

      <Box
        component="ul"
        sx={(theme) => ({
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          m: 0,
          p: 0,
          listStyle: "none",
          borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 0 },
          "& > li": {
            minWidth: 0,
            borderTop: `1px solid ${theme.palette.divider}`
          },
          "& > li:nth-of-type(even)": {
            borderLeft: { xs: 0, md: `1px solid ${theme.palette.divider}` }
          },
          "& > li:nth-of-type(n+3)": {
            borderBottom: { xs: 0, md: `1px solid ${theme.palette.divider}` }
          }
        })}
      >
        {QUICK_ACTIONS.map((action) => (
          <Box component="li" key={action.title}>
            <ButtonBase
              onClick={() => onNavigate(action.target)}
              aria-label={`${action.title}: ${action.description}. Vai a ${action.destination}`}
              sx={(theme) => {
                const accent = theme.palette[action.tone].main;

                return {
                  position: "relative",
                  width: "100%",
                  minWidth: 0,
                  minHeight: 76,
                  display: "grid",
                  gridTemplateColumns: "28px minmax(0, 1fr) auto",
                  columnGap: 1.5,
                  alignItems: "center",
                  px: { xs: 1, sm: 1.5 },
                  py: 1.25,
                  textAlign: "left",
                  overflow: "hidden",
                  transition: "background-color 160ms ease",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    inset: "10px auto 10px 0",
                    width: 2,
                    bgcolor: accent,
                    transform: "scaleY(0)",
                    transformOrigin: "center",
                    transition: "transform 160ms ease"
                  },
                  "&:hover": {
                    bgcolor: alpha(accent, theme.palette.mode === "light" ? 0.055 : 0.1)
                  },
                  "&:hover::before": {
                    transform: "scaleY(1)"
                  },
                  "&:hover .quick-action-arrow": {
                    color: accent,
                    transform: "translateX(3px)"
                  },
                  "&:focus-visible": {
                    zIndex: 1,
                    outline: `3px solid ${alpha(accent, 0.24)}`,
                    outlineOffset: -3
                  }
                };
              }}
            >
              <Box
                sx={(theme) => ({
                  display: "grid",
                  placeItems: "center",
                  color: theme.palette[action.tone].main,
                  "& svg": { fontSize: 21 }
                })}
              >
                {action.icon}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  {action.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.2 }}>
                  {action.description}
                </Typography>
                <Typography
                  variant="caption"
                  component="div"
                  sx={(theme) => ({ color: theme.palette[action.tone].main, fontWeight: 750, mt: 0.1 })}
                >
                  {action.destination}
                </Typography>
              </Box>

              <ArrowForwardRoundedIcon
                className="quick-action-arrow"
                sx={{
                  flexShrink: 0,
                  fontSize: 19,
                  color: "text.disabled",
                  transition: "color 160ms ease, transform 160ms ease"
                }}
              />
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
