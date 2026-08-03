import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import { alpha, Box, ButtonBase, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { DashboardSection } from "./DashboardSidebar";

type DashboardQuickActionsProps = {
  dockerAvailable: boolean;
  onNavigate: (section: DashboardSection) => void;
};

type ActionTone = "primary" | "info" | "success" | "warning";

type QuickAction = {
  title: string;
  description: string;
  target: DashboardSection;
  tone: ActionTone;
  icon: ReactNode;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Repository",
    description: "Apri Git e terminale",
    target: "repositories",
    tone: "info",
    icon: <AccountTreeOutlinedIcon />
  },
  {
    title: "Docker",
    description: "Controlla i servizi",
    target: "docker",
    tone: "success",
    icon: <StorageOutlinedIcon />
  },
  {
    title: "Preferiti",
    description: "Riprendi il lavoro",
    target: "favorites",
    tone: "warning",
    icon: <StarBorderRoundedIcon />
  }
];

export function DashboardQuickActions({ dockerAvailable, onNavigate }: DashboardQuickActionsProps) {
  const visibleActions = dockerAvailable
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter((action) => action.target !== "docker");

  return (
    <Box
      component="ul"
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "repeat(auto-fit, minmax(170px, 1fr))"
        },
        gap: 1,
        m: 0,
        p: 0,
        listStyle: "none"
      }}
    >
      {visibleActions.map((action) => (
        <Box component="li" key={action.title} sx={{ minWidth: 0 }}>
          <ButtonBase
            onClick={() => onNavigate(action.target)}
            aria-label={`${action.title}: ${action.description}`}
            sx={(theme) => {
              const accent = theme.palette[action.tone].main;

              return {
                position: "relative",
                width: "100%",
                minWidth: 0,
                minHeight: 78,
                display: "grid",
                gridTemplateColumns: { xs: "30px minmax(0, 1fr)", sm: "30px minmax(0, 1fr) 18px" },
                columnGap: 1,
                alignItems: "center",
                px: { xs: 1, sm: 1.25 },
                py: 1.1,
                textAlign: "left",
                overflow: "hidden",
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.94 : 0.88),
                transition: "background-color 160ms ease, border-color 160ms ease",
                "&:hover": {
                  bgcolor: alpha(accent, theme.palette.mode === "light" ? 0.07 : 0.13),
                  borderColor: alpha(accent, 0.42)
                },
                "&:hover .quick-action-arrow": {
                  color: accent,
                  transform: "translateX(2px)"
                },
                "&:focus-visible": {
                  outline: `3px solid ${alpha(accent, 0.24)}`,
                  outlineOffset: 2
                }
              };
            }}
          >
            <Box
              sx={(theme) => ({
                width: 30,
                height: 30,
                display: "grid",
                placeItems: "center",
                color: theme.palette[action.tone].main,
                bgcolor: alpha(theme.palette[action.tone].main, 0.1),
                borderRadius: 1,
                "& svg": { fontSize: 18 }
              })}
            >
              {action.icon}
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                {action.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mt: 0.2 }}>
                {action.description}
              </Typography>
            </Box>

            <ArrowForwardRoundedIcon
              className="quick-action-arrow"
              sx={{
                display: { xs: "none", sm: "block" },
                fontSize: 17,
                color: "text.disabled",
                transition: "color 160ms ease, transform 160ms ease"
              }}
            />
          </ButtonBase>
        </Box>
      ))}
    </Box>
  );
}
