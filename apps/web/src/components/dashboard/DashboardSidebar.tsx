import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  alpha,
  Box,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../../config";
import { COLOR_PALETTE_OPTIONS } from "../../theme";
import type { ColorPalette } from "../../types/common";
import type { ProjectSummary } from "../../types/projects";
import { WorkspaceToolbarPicker } from "./WorkspaceToolbarPicker";

export type DashboardSection =
  | "overview"
  | "tasks"
  | "agents"
  | "automations"
  | "docker"
  | "favorites"
  | "repositories"
  | "settings";

const DESKTOP_SIDEBAR_WIDTH = 236;
const COLLAPSED_SIDEBAR_WIDTH = 64;
const MOBILE_SIDEBAR_WIDTH = 276;

const NAV_ITEMS: Array<{
  id: DashboardSection;
  labelKey: `navigation.sections.${DashboardSection}`;
  icon: React.ReactElement;
}> = [
  { id: "overview", labelKey: "navigation.sections.overview", icon: <DashboardOutlinedIcon /> },
  { id: "repositories", labelKey: "navigation.sections.repositories", icon: <AccountTreeOutlinedIcon /> },
  { id: "favorites", labelKey: "navigation.sections.favorites", icon: <StarBorderOutlinedIcon /> },
  { id: "docker", labelKey: "navigation.sections.docker", icon: <StorageOutlinedIcon /> },
  { id: "agents", labelKey: "navigation.sections.agents", icon: <SmartToyOutlinedIcon /> },
  { id: "automations", labelKey: "navigation.sections.automations", icon: <HubOutlinedIcon /> },
  { id: "tasks", labelKey: "navigation.sections.tasks", icon: <LanOutlinedIcon /> },
  { id: "settings", labelKey: "navigation.sections.settings", icon: <SettingsOutlinedIcon /> }
];

type DashboardSidebarProps = {
  activeSection: DashboardSection;
  collapsed: boolean;
  mobileOpen: boolean;
  colorPalette: ColorPalette;
  repositoryCount: number;
  favoriteCount: number;
  dockerCount: number;
  dockerAvailable: boolean;
  workspaceRoot: string;
  rootError: string | null;
  isPickingRoot: boolean;
  isScanningRoot?: boolean;
  openProjects?: ProjectSummary[];
  activeProjectId?: string | null;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject?: (projectId: string) => void;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  onPickWorkspace: () => void;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
};

export function DashboardSidebar(props: DashboardSidebarProps) {
  const { t } = useTranslation();

  return (
    <>
      <Box
        component="aside"
        aria-label={t("navigation.ariaLabel")}
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
          "aria-label": t("navigation.mobileAriaLabel"),
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
  dockerAvailable,
  workspaceRoot,
  rootError,
  isPickingRoot,
  isScanningRoot = false,
  openProjects = [],
  activeProjectId = null,
  onNavigate,
  onOpenProject,
  onToggleCollapsed,
  onCloseMobile,
  onPickWorkspace,
  onColorPaletteChange,
  isMobile
}: SidebarContentProps) {
  const { t } = useTranslation();
  const [paletteMenuAnchor, setPaletteMenuAnchor] = React.useState<HTMLElement | null>(null);
  const paletteMenuId = React.useId();
  const isWorkspaceBusy = isPickingRoot || isScanningRoot;
  const workspacePickerLabel = isPickingRoot
    ? t("navigation.openingFolderPicker")
    : isScanningRoot
      ? t("navigation.scanningWorkspace")
      : t("navigation.changeWorkspace");
  const activePalette = COLOR_PALETTE_OPTIONS.find((option) => option.id === colorPalette)
    ?? COLOR_PALETTE_OPTIONS[0];
  const counts: Record<DashboardSection, number | null> = {
    overview: null,
    tasks: null,
    agents: null,
    automations: null,
    repositories: repositoryCount,
    favorites: favoriteCount,
    docker: dockerCount,
    settings: null
  };

  return (
    <Stack sx={{ width: "100%", minWidth: 0, height: "100%" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={collapsed ? "center" : "flex-start"}
        spacing={collapsed ? 0 : 1}
        sx={{ minHeight: 62, px: collapsed ? 1 : 1.5, flexShrink: 0 }}
      >
        <Box
          component="img"
          data-testid="repo-control-logo"
          src="/icon/repo-control-icon-medium.svg"
          alt=""
          aria-hidden="true"
          sx={{
            width: 30,
            height: 30,
            display: collapsed ? "none" : "block",
            flexShrink: 0,
            borderRadius: 1
          }}
        />
        {collapsed ? null : (
          <Box sx={{ minWidth: 0, flexGrow: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, lineHeight: 1.25 }}>
              repo-control
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              noWrap
              sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}
            >
              local · v{APP_VERSION}
            </Typography>
          </Box>
        )}
        {isMobile ? null : (
          <Tooltip title={collapsed ? t("navigation.expandSidebar") : t("navigation.collapseSidebar")} placement="right">
            <IconButton
              size="small"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? t("navigation.expandSidebar") : t("navigation.collapseSidebar")}
              sx={{ flexShrink: 0 }}
            >
              {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      <Divider />

      <Box
        component="nav"
        aria-label={t("navigation.sectionsAriaLabel")}
        sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", px: 1, py: 1.25 }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{
            display: "block",
            height: collapsed ? 0 : 22,
            px: 1,
            opacity: collapsed ? 0 : 1,
            overflow: "hidden",
            transition: "opacity 140ms ease, height 180ms ease"
          }}
        >
          {t("navigation.workspaceGroup")}
        </Typography>
        <Stack spacing={0.25}>
          {NAV_ITEMS.filter((item) => item.id !== "docker" || dockerAvailable).map((item) => {
            const count = counts[item.id];
            const isActive = activeSection === item.id;
            const label = t(item.labelKey);

            return (
              <Tooltip key={item.id} title={collapsed ? label : ""} placement="right">
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
                    minHeight: 36,
                    px: collapsed ? 0 : 1.25,
                    justifyContent: collapsed ? "center" : "flex-start",
                    borderRadius: "var(--rc-radius-control)",
                    color: isActive ? "text.primary" : "text.secondary",
                    bgcolor: isActive ? "var(--rc-surface-3)" : "transparent",
                    transition: "background-color var(--rc-motion-fast) ease, color var(--rc-motion-fast) ease",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 7,
                      bottom: 7,
                      width: 2.5,
                      height: "auto",
                      borderRadius: "0 3px 3px 0",
                      bgcolor: "primary.main",
                      transform: isActive ? "scaleY(1)" : "scaleY(0)",
                      transition: "transform var(--rc-motion-base) ease"
                    },
                    "&:hover": {
                      color: "text.primary",
                      bgcolor: "var(--rc-surface-2)"
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
                      fontWeight: isActive ? 500 : 400,
                      transition: "opacity 140ms ease, max-width 220ms ease"
                    }}
                  >
                    {label}
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

        {!collapsed && openProjects.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block", px: 1, mb: 0.5 }}>
              {t("navigation.openProjects")}
            </Typography>
            <Stack spacing={0.25}>
              {openProjects.slice(0, 5).map((project) => {
                const isActiveProject = project.id === activeProjectId;

                return (
                  <ButtonBase
                    key={project.id}
                    onClick={() => {
                      onOpenProject?.(project.id);
                      if (isMobile) onCloseMobile();
                    }}
                    sx={{
                      minHeight: 32,
                      width: "100%",
                      px: 1,
                      gap: 0.9,
                      justifyContent: "flex-start",
                      borderRadius: "var(--rc-radius-control)",
                      color: isActiveProject ? "text.primary" : "text.secondary",
                      bgcolor: isActiveProject ? "action.selected" : "transparent",
                      "&:hover": { bgcolor: "var(--rc-surface-2)", color: "text.primary" }
                    }}
                  >
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 6,
                        height: 6,
                        flexShrink: 0,
                        borderRadius: "50%",
                        bgcolor: project.isClean ? "success.main" : "warning.main"
                      }}
                    />
                    <Box sx={{ minWidth: 0, textAlign: "left" }}>
                      <Typography variant="caption" noWrap component="div" sx={{ fontWeight: 500 }}>
                        {project.name}
                      </Typography>
                      <Typography
                        noWrap
                        component="div"
                        color="text.secondary"
                        sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}
                      >
                        {project.branch}
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Stack>
          </Box>
        ) : null}
      </Box>

      <Box
        sx={{
          p: 1,
          flexShrink: 0,
          bgcolor: "var(--rc-surface-2)",
          borderTop: "1px solid",
          borderColor: "divider"
        }}
      >
        {collapsed ? (
          <Tooltip
            title={isWorkspaceBusy
              ? workspacePickerLabel
              : `${workspaceRoot || t("navigation.selectWorkspace")} · Ctrl+O`}
            placement="right"
            disableInteractive
          >
            <span>
              <IconButton
                onClick={onPickWorkspace}
                disabled={isWorkspaceBusy}
                color={rootError ? "error" : "primary"}
                aria-label={workspacePickerLabel}
                sx={{ display: "flex", mx: "auto" }}
              >
                {isWorkspaceBusy ? <CircularProgress color="inherit" size={17} /> : <FolderOpenOutlinedIcon />}
              </IconButton>
            </span>
          </Tooltip>
        ) : (
          <WorkspaceToolbarPicker
            root={workspaceRoot}
            error={rootError}
            isPicking={isPickingRoot}
            isScanning={isScanningRoot}
            onPick={onPickWorkspace}
          />
        )}
      </Box>

      <Box sx={{ px: 1, pb: 1, flexShrink: 0, bgcolor: "var(--rc-surface-2)" }}>
        <Tooltip
          title={collapsed
            ? t("navigation.appearanceActive", { palette: t(`appearance.palettes.${activePalette.id}.label`) })
            : ""}
          placement="right"
        >
          <ButtonBase
            onClick={(event) => setPaletteMenuAnchor(event.currentTarget)}
            aria-label={t("navigation.selectPalette", {
              palette: t(`appearance.palettes.${activePalette.id}.label`)
            })}
            aria-haspopup="menu"
            aria-controls={paletteMenuAnchor ? paletteMenuId : undefined}
            aria-expanded={Boolean(paletteMenuAnchor)}
            sx={{
              width: "100%",
              minHeight: collapsed ? 38 : 46,
              px: collapsed ? 0 : 1,
              justifyContent: collapsed ? "center" : "flex-start",
              gap: 1,
              border: "1px solid",
              borderColor: paletteMenuAnchor ? "primary.main" : "transparent",
              borderRadius: "var(--rc-radius-control)",
              color: "text.secondary",
              bgcolor: paletteMenuAnchor ? "var(--rc-accent-tint)" : "transparent",
              transition: "background-color var(--rc-motion-fast) ease, border-color var(--rc-motion-fast) ease",
              "&:hover": { bgcolor: "background.paper", color: "text.primary", borderColor: "divider" },
              "&:focus-visible": {
                outline: (theme) => `3px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                outlineOffset: 1
              }
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 24,
                height: 24,
                flexShrink: 0,
                border: "1px solid var(--rc-border-strong)",
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${activePalette.surface} 0 50%, ${activePalette.color} 50% 100%)`,
                boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`
              }}
            />
            {collapsed ? null : (
              <Box sx={{ minWidth: 0, textAlign: "left" }}>
                <Typography component="div" variant="overline" color="text.disabled" sx={{ lineHeight: 1.15 }}>
                  {t("navigation.appearance")}
                </Typography>
                <Typography component="div" variant="body2" noWrap sx={{ mt: 0.2, fontWeight: 500, color: "text.primary" }}>
                  {t(`appearance.palettes.${activePalette.id}.label`)}
                </Typography>
              </Box>
            )}
            {collapsed ? null : (
              <KeyboardArrowDownRoundedIcon
                fontSize="small"
                sx={{
                  ml: "auto",
                  transform: paletteMenuAnchor ? "rotate(180deg)" : "none",
                  transition: "transform 160ms ease"
                }}
              />
            )}
          </ButtonBase>
        </Tooltip>
        <Menu
          id={paletteMenuId}
          anchorEl={paletteMenuAnchor}
          open={Boolean(paletteMenuAnchor)}
          onClose={() => setPaletteMenuAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{
            list: {
              "aria-label": t("navigation.paletteMenu"),
              sx: { p: 0.75, minWidth: 224 }
            },
            paper: {
              sx: {
                ml: 0.75,
                mb: 0.75,
                border: "1px solid",
                borderColor: "divider"
              }
            }
          }}
        >
          <ListSubheader
            disableSticky
            sx={{ px: 1.25, py: 0.75, bgcolor: "transparent", lineHeight: 1.25 }}
          >
            <Typography variant="overline" color="text.disabled" component="div">
              {t("navigation.appearanceMenuTitle")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.35, fontSize: 10.5, whiteSpace: "normal" }}>
              {t("navigation.appearanceMenuDescription")}
            </Typography>
          </ListSubheader>
          {COLOR_PALETTE_OPTIONS.map((option) => {
            const isSelected = option.id === colorPalette;

            return (
              <MenuItem
                key={option.id}
                role="menuitemradio"
                aria-label={t(`appearance.palettes.${option.id}.label`)}
                aria-checked={isSelected}
                selected={isSelected}
                onClick={() => {
                  onColorPaletteChange(option.id);
                  setPaletteMenuAnchor(null);
                }}
                sx={{ minHeight: 48, borderRadius: 0.75, gap: 1.25 }}
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
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={isSelected ? 600 : 500}>
                    {t(`appearance.palettes.${option.id}.label`)}
                  </Typography>
                  <Typography component="div" color="text.disabled" sx={{ mt: 0.1, fontSize: 10 }}>
                    {t(`appearance.palettes.${option.id}.description`)}
                  </Typography>
                </Box>
                {isSelected ? <CheckRoundedIcon color="primary" fontSize="small" /> : null}
              </MenuItem>
            );
          })}
        </Menu>
      </Box>
    </Stack>
  );
}
