import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import {
  alpha,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import { APP_VERSION } from "../../config";
import { COLOR_PALETTE_OPTIONS } from "../../theme";
import type { ColorPalette } from "../../types/common";
import { WorkspaceToolbarPicker } from "./WorkspaceToolbarPicker";

export type DashboardSection = "overview" | "tasks" | "automations" | "docker" | "favorites" | "repositories";

const DESKTOP_SIDEBAR_WIDTH = 248;
const COLLAPSED_SIDEBAR_WIDTH = 76;
const MOBILE_SIDEBAR_WIDTH = 276;

const NAV_ITEMS: Array<{
  id: DashboardSection;
  label: string;
  icon: React.ReactElement;
}> = [
  { id: "overview", label: "Dashboard", icon: <DashboardOutlinedIcon /> },
  { id: "tasks", label: "Task engineering", icon: <TaskAltOutlinedIcon /> },
  { id: "automations", label: "Automazioni", icon: <HubOutlinedIcon /> },
  { id: "docker", label: "Docker", icon: <StorageOutlinedIcon /> },
  { id: "favorites", label: "Preferiti", icon: <StarBorderOutlinedIcon /> },
  { id: "repositories", label: "Repository", icon: <AccountTreeOutlinedIcon /> }
];

type DashboardSidebarProps = {
  activeSection: DashboardSection;
  collapsed: boolean;
  mobileOpen: boolean;
  colorPalette: ColorPalette;
  repositoryCount: number;
  favoriteCount: number;
  dockerCount: number;
  workspaceRoot: string;
  rootError: string | null;
  isPickingRoot: boolean;
  onNavigate: (section: DashboardSection) => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onPickWorkspace: () => void;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
};

export function DashboardSidebar(props: DashboardSidebarProps) {
  return (
    <>
      <Box
        component="aside"
        aria-label="Navigazione dashboard"
        sx={{
          display: { xs: "none", md: "flex" },
          position: "sticky",
          top: 0,
          width: props.collapsed ? COLLAPSED_SIDEBAR_WIDTH : DESKTOP_SIDEBAR_WIDTH,
          height: "100dvh",
          flexShrink: 0,
          zIndex: (theme) => theme.zIndex.appBar + 1,
          overflow: "hidden",
          borderRight: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          transition: "width 220ms cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <SidebarContent {...props} isMobile={false} />
      </Box>

      <Drawer
        open={props.mobileOpen}
        onClose={props.onCloseMobile}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          component: "aside",
          "aria-label": "Navigazione dashboard mobile",
          sx: {
            width: MOBILE_SIDEBAR_WIDTH,
            maxWidth: "calc(100vw - 32px)",
            overflow: "hidden",
            bgcolor: "background.paper",
            backgroundImage: "none"
          }
        }}
        sx={{ display: { xs: "block", md: "none" } }}
      >
        <SidebarContent {...props} collapsed={false} isMobile />
      </Drawer>
    </>
  );
}

type SidebarContentProps = DashboardSidebarProps & {
  isMobile: boolean;
};

function SidebarContent({
  activeSection,
  collapsed,
  colorPalette,
  repositoryCount,
  favoriteCount,
  dockerCount,
  workspaceRoot,
  rootError,
  isPickingRoot,
  onNavigate,
  onToggleCollapsed,
  onCloseMobile,
  onPickWorkspace,
  onColorPaletteChange,
  isMobile
}: SidebarContentProps) {
  const [paletteMenuAnchor, setPaletteMenuAnchor] = React.useState<HTMLElement | null>(null);
  const activePalette = COLOR_PALETTE_OPTIONS.find((option) => option.id === colorPalette)
    ?? COLOR_PALETTE_OPTIONS[0];
  const counts: Record<DashboardSection, number | null> = {
    overview: null,
    tasks: null,
    automations: null,
    repositories: repositoryCount,
    favorites: favoriteCount,
    docker: dockerCount
  };

  return (
    <Stack sx={{ width: "100%", minWidth: 0, height: "100%" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={collapsed ? "center" : "flex-start"}
        spacing={collapsed ? 0 : 1}
        sx={{ minHeight: 68, px: collapsed ? 1 : 1.75, flexShrink: 0 }}
      >
        {collapsed ? null : (
          <>
            <Box sx={{ minWidth: 0, flexGrow: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
              <Typography noWrap sx={{ fontSize: "0.95rem", fontWeight: 800 }}>
                repo-control
              </Typography>
              <Stack direction="row" spacing={0.6} alignItems="center">
                <Box
                  aria-hidden="true"
                  sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "secondary.main" }}
                />
                <Typography variant="caption" color="text.secondary" noWrap>
                  Workspace locale
                </Typography>
              </Stack>
            </Box>
          </>
        )}
        {isMobile ? null : (
          <Tooltip title={collapsed ? "Espandi sidebar" : "Comprimi sidebar"} placement="right">
            <IconButton
              size="small"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? "Espandi sidebar" : "Comprimi sidebar"}
              sx={{ flexShrink: 0 }}
            >
              {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Divider />

      <Box component="nav" aria-label="Sezioni dashboard" sx={{ flexGrow: 1, minHeight: 0, px: 1, py: 1.5 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{
            display: "block",
            height: collapsed ? 0 : 24,
            px: 1,
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            transition: "opacity 140ms ease, height 180ms ease"
          }}
        >
          Spazio di lavoro
        </Typography>
        <Stack spacing={0.5}>
          {NAV_ITEMS.map((item) => {
            const count = counts[item.id];
            const isActive = activeSection === item.id;

            return (
              <Tooltip key={item.id} title={collapsed ? item.label : ""} placement="right">
                <ButtonBase
                  data-dashboard-section={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isMobile) {
                      onCloseMobile();
                    }
                  }}
                  aria-current={isActive ? "page" : undefined}
                  sx={{
                    position: "relative",
                    width: "100%",
                    minHeight: 44,
                    px: collapsed ? 0 : 1.25,
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: 1,
                    color: isActive ? "primary.main" : "text.secondary",
                    bgcolor: isActive ? "action.selected" : "transparent",
                    transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      width: 3,
                      height: 22,
                      borderRadius: "0 3px 3px 0",
                      bgcolor: "primary.main",
                      transform: isActive ? "translateY(-50%) scaleY(1)" : "translateY(-50%) scaleY(0)",
                      transition: "transform 180ms cubic-bezier(0.4, 0, 0.2, 1)"
                    },
                    "&:hover": {
                      color: "text.primary",
                      bgcolor: "action.hover",
                      transform: collapsed ? "none" : "translateX(2px)"
                    },
                    "&:focus-visible": {
                      outline: (theme) => `3px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                      outlineOffset: 1
                    }
                  }}
                >
                  <Box sx={{ width: 24, height: 24, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                  </Box>
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{
                      ml: 1.25,
                      minWidth: 0,
                      flexGrow: 1,
                      maxWidth: collapsed ? 0 : 140,
                      opacity: collapsed ? 0 : 1,
                      overflow: "hidden",
                      textAlign: "left",
                      fontWeight: isActive ? 750 : 600,
                      transition: "opacity 140ms ease, max-width 220ms ease"
                    }}
                  >
                    {item.label}
                  </Typography>
                  {!collapsed && count !== null ? (
                    <Chip
                      size="small"
                      label={count}
                      variant={isActive ? "filled" : "outlined"}
                      color={isActive ? "primary" : "default"}
                      sx={{ ml: 0.75, flexShrink: 0 }}
                    />
                  ) : null}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ p: 1, flexShrink: 0 }}>
        {collapsed ? (
          <Tooltip
            title={`${workspaceRoot || "Seleziona workspace"} · Ctrl+O`}
            placement="right"
            disableInteractive
          >
            <span>
              <IconButton
                onClick={onPickWorkspace}
                disabled={isPickingRoot}
                color={rootError ? "error" : "primary"}
                aria-label="Cambia workspace folder, scorciatoia Ctrl+O"
                sx={{ display: "flex", mx: "auto" }}
              >
                {isPickingRoot ? <CircularProgress color="inherit" size={17} /> : <FolderOpenOutlinedIcon />}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <WorkspaceToolbarPicker
            root={workspaceRoot}
            error={rootError}
            isPicking={isPickingRoot}
            onPick={onPickWorkspace}
          />
        )}
      </Box>

      <Divider />

      <Box sx={{ p: 1, flexShrink: 0 }}>
        <Tooltip title={collapsed ? `Palette: ${activePalette.label}` : ""} placement="right">
          <ButtonBase
            onClick={(event) => setPaletteMenuAnchor(event.currentTarget)}
            aria-label={`Seleziona palette colori. Attiva: ${activePalette.label}`}
            aria-haspopup="menu"
            aria-expanded={Boolean(paletteMenuAnchor)}
            sx={{
              width: "100%",
              minHeight: 40,
              px: collapsed ? 0 : 1.25,
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 1,
              color: "text.secondary",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" }
            }}
          >
            <PaletteOutlinedIcon fontSize="small" />
            {collapsed ? null : (
              <Typography variant="body2" sx={{ ml: 1.25, fontWeight: 600 }}>
                {activePalette.label}
              </Typography>
            )}
            {collapsed ? null : (
              <Typography variant="caption" color="text.disabled" sx={{ ml: "auto" }}>
                v{APP_VERSION}
              </Typography>
            )}
            {collapsed ? null : (
              <KeyboardArrowDownRoundedIcon
                fontSize="small"
                sx={{
                  ml: 0.5,
                  transform: paletteMenuAnchor ? "rotate(180deg)" : "none",
                  transition: "transform 160ms ease"
                }}
              />
            )}
          </ButtonBase>
        </Tooltip>
        <Menu
          anchorEl={paletteMenuAnchor}
          open={Boolean(paletteMenuAnchor)}
          onClose={() => setPaletteMenuAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: collapsed ? "right" : "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{
            list: {
              "aria-label": "Palette colori",
              sx: { p: 0.75, minWidth: 196 }
            },
            paper: {
              sx: {
                mb: 0.75,
                border: "1px solid",
                borderColor: "divider"
              }
            }
          }}
        >
          {COLOR_PALETTE_OPTIONS.map((option) => {
            const isSelected = option.id === colorPalette;

            return (
              <MenuItem
                key={option.id}
                role="menuitemradio"
                aria-checked={isSelected}
                selected={isSelected}
                onClick={() => {
                  onColorPaletteChange(option.id);
                  setPaletteMenuAnchor(null);
                }}
                sx={{ minHeight: 42, borderRadius: 0.75, gap: 1.25 }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${option.surface} 0 50%, ${option.color} 50% 100%)`,
                    boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`
                  }}
                />
                <Typography variant="body2" fontWeight={isSelected ? 750 : 600} sx={{ flexGrow: 1 }}>
                  {option.label}
                </Typography>
                {isSelected ? <CheckRoundedIcon color="primary" fontSize="small" /> : null}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>
    </Stack>
  );
}
