import { keyframes } from "@emotion/react";
import MenuIcon from "@mui/icons-material/Menu";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SyncIcon from "@mui/icons-material/Sync";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  alpha,
  AppBar,
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import type { AppUpdateStatus } from "../../types/app";
import type { ViewMode } from "../../types/common";
import { APP_VERSION } from "../../config";
import type { DashboardSection } from "./DashboardSidebar";

const SECTION_LABELS: Record<DashboardSection, string> = {
  overview: "Dashboard",
  tasks: "Task engineering",
  agents: "Agent sessions",
  automations: "Automazioni",
  docker: "Docker runtime",
  favorites: "Preferiti",
  repositories: "Repository"
};

const updateAvailablePulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.36); }
  70% { box-shadow: 0 0 0 8px rgba(37, 99, 235, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
`;

type DashboardAppBarProps = {
  activeSection: DashboardSection;
  activeProjectName: string | null;
  search: string;
  viewMode: ViewMode;
  appUpdateStatus: AppUpdateStatus | undefined;
  appUpdateStatusError: unknown;
  isCheckingAppUpdate: boolean;
  isLoadingAppUpdateStatus: boolean;
  isUpdatingApp: boolean;
  isFetchingProjects: boolean;
  onOpenMobileNavigation: () => void;
  onOpenSearch: () => void;
  onUpdateApp: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onRefreshProjects: () => void;
};

export function DashboardAppBar({
  activeSection,
  activeProjectName,
  search,
  viewMode,
  appUpdateStatus,
  appUpdateStatusError,
  isCheckingAppUpdate,
  isLoadingAppUpdateStatus,
  isUpdatingApp,
  isFetchingProjects,
  onOpenMobileNavigation,
  onOpenSearch,
  onUpdateApp,
  onViewModeChange,
  onRefreshProjects
}: DashboardAppBarProps) {
  const canUpdateApp = Boolean(appUpdateStatus?.updateAvailable) && !isUpdatingApp;
  const updateTooltip = getUpdateTooltip(
    appUpdateStatus,
    isLoadingAppUpdateStatus || (isCheckingAppUpdate && !appUpdateStatus),
    appUpdateStatusError,
    isUpdatingApp
  );

  return (
    <AppBar
      component="header"
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        top: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.94),
        borderBottom: "1px solid",
        borderColor: "divider",
        backdropFilter: "blur(14px)"
      }}
    >
      <Toolbar
        sx={{
          width: "100%",
          maxWidth: 1680,
          mx: "auto",
          minHeight: { xs: "auto", md: 68 },
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr) auto",
            md: "minmax(170px, 0.55fr) minmax(320px, 1.45fr) auto"
          },
          gridTemplateAreas: {
            xs: '"context actions" "search search"',
            md: '"context search actions"'
          },
          alignItems: "center",
          gap: { xs: 1, md: 2 },
          px: { xs: 1.5, sm: 2.5, lg: 3 },
          py: { xs: 1.25, md: 0 }
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ gridArea: "context", justifySelf: "start", minWidth: 0, overflow: "hidden" }}
        >
          <IconButton
            onClick={onOpenMobileNavigation}
            aria-label="Apri navigazione"
            sx={{ display: { xs: "inline-flex", md: "none" }, flexShrink: 0 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              <Box component="span" sx={{ display: { xs: "inline", md: "none" }, fontWeight: 750 }}>
                repo-control ·{" "}
              </Box>
              {activeProjectName ? "Repository" : "Workspace"}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 750 }}>
              {activeProjectName ?? SECTION_LABELS[activeSection]}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ gridArea: "search", justifySelf: { xs: "stretch", md: "center" }, width: { xs: "100%", md: "min(100%, 760px)" } }}>
          <Tooltip title="Cerca repository (Ctrl+P)" placement="bottom">
            <TextField
              fullWidth
              size="small"
              value={search}
              onClick={onOpenSearch}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenSearch();
                }
              }}
              placeholder="Cerca repository"
              variant="outlined"
              inputProps={{ "aria-label": "Apri ricerca repository, scorciatoia Ctrl+P" }}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      component="kbd"
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        px: 0.7,
                        py: 0.2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 0.5,
                        bgcolor: "action.hover",
                        fontFamily: "inherit",
                        fontSize: "0.65rem"
                      }}
                    >
                      Ctrl+P
                    </Typography>
                  </InputAdornment>
                )
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 38,
                  borderRadius: 0.875,
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  "&:hover fieldset": { borderColor: "primary.main" },
                  "&.Mui-focused fieldset": { borderWidth: 1 }
                },
                "& .MuiInputBase-input": { cursor: "pointer" }
              }}
            />
          </Tooltip>
        </Box>

        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ gridArea: "actions", justifySelf: "end", minWidth: 0 }}
        >
          <Chip
            size="small"
            variant="outlined"
            color={appUpdateStatus?.updateAvailable ? "primary" : "default"}
            label={`v${APP_VERSION}`}
            sx={{ display: { xs: "none", sm: "flex" } }}
          />
          <Tooltip title={updateTooltip}>
            <span>
              <Badge
                color="warning"
                variant="dot"
                invisible={!canUpdateApp}
                overlap="rectangular"
                sx={{
                  "& .MuiBadge-badge": {
                    boxShadow: (theme) => `0 0 0 2px ${theme.palette.background.paper}`
                  }
                }}
              >
                <Button
                  size="small"
                  variant={canUpdateApp ? "contained" : "outlined"}
                  color={canUpdateApp ? "primary" : "inherit"}
                  aria-label={getUpdateAriaLabel(appUpdateStatus, canUpdateApp)}
                  startIcon={
                    isUpdatingApp || (isCheckingAppUpdate && !appUpdateStatus) ? (
                      <CircularProgress color="inherit" size={16} />
                    ) : (
                      <SyncIcon fontSize="small" />
                    )
                  }
                  onClick={onUpdateApp}
                  disabled={!canUpdateApp}
                  sx={{
                    minWidth: { xs: 36, sm: 104 },
                    px: { xs: 1, sm: 1.5 },
                    fontWeight: canUpdateApp ? 800 : 500,
                    animation: canUpdateApp ? `${updateAvailablePulse} 1.8s ease-in-out infinite` : "none",
                    boxShadow: canUpdateApp ? "0 0 18px rgba(37, 99, 235, 0.32)" : undefined,
                    "&:hover": {
                      boxShadow: canUpdateApp ? "0 0 22px rgba(37, 99, 235, 0.42)" : undefined
                    },
                    "& .MuiButton-startIcon": {
                      ml: 0,
                      mr: { xs: 0, sm: 0.75 }
                    }
                  }}
                >
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>Aggiorna</Box>
                </Button>
              </Badge>
            </span>
          </Tooltip>
          {activeSection === "repositories" && !activeProjectName ? (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              size="small"
              onChange={(_, nextMode: ViewMode | null) => {
                if (nextMode) onViewModeChange(nextMode);
              }}
              aria-label="Modalità vista"
            >
              <ToggleButton value="map" aria-label="Griglia repository">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label="Vista tabella">
                <TableRowsIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          ) : null}
          {activeSection === "repositories" || activeSection === "favorites" ? (
            <Tooltip title="Aggiorna repository">
              <span>
                <IconButton
                  onClick={onRefreshProjects}
                  disabled={isFetchingProjects}
                  aria-label="Aggiorna repository"
                  size="small"
                >
                  {isFetchingProjects ? <CircularProgress size={20} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

function getUpdateTooltip(
  status: AppUpdateStatus | undefined,
  isLoading: boolean,
  error: unknown,
  isUpdating: boolean
): string {
  if (isUpdating) return "Aggiornamento in corso";
  if (isLoading) return "Controllo nuove release in corso";
  if (status?.updateAvailable && status.latestVersion) return `Nuova release disponibile: v${status.latestVersion}`;
  if (status?.error) return `Controllo release non disponibile: ${status.error}`;
  if (error instanceof Error) return `Controllo release non riuscito: ${error.message}`;
  return "Nessuna nuova release disponibile";
}

function getUpdateAriaLabel(status: AppUpdateStatus | undefined, canUpdate: boolean): string {
  if (canUpdate && status?.latestVersion) return `Aggiorna repo-control alla versione ${status.latestVersion}`;
  return "Aggiorna repo-control";
}
