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
import { APP_VERSION } from "../../config";
import type { AppUpdateStatus } from "../../types/app";
import type { ViewMode } from "../../types/common";
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
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.97),
        borderBottom: "1px solid",
        borderColor: "divider",
        backdropFilter: "blur(16px)"
      }}
    >
      <Toolbar
        sx={{
          width: "100%",
          minHeight: { xs: "auto", md: 52 },
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr) auto",
            md: "minmax(220px, 1fr) minmax(320px, 560px) minmax(220px, 1fr)"
          },
          gridTemplateAreas: {
            xs: '"context actions" "search search"',
            md: '"context search actions"'
          },
          alignItems: "center",
          gap: { xs: 1, md: 2.25 },
          px: { xs: 1.25, sm: 2, lg: 2.75 },
          py: { xs: 1, md: 0 }
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
          <Typography variant="caption" color="text.secondary" noWrap>
            Workspace
          </Typography>
          <Typography aria-hidden="true" variant="caption" color="text.disabled">/</Typography>
          {activeProjectName ? (
            <>
              <Typography variant="caption" color="text.secondary" noWrap>Repository</Typography>
              <Typography aria-hidden="true" variant="caption" color="text.disabled">/</Typography>
            </>
          ) : null}
          <Typography variant="caption" color="text.primary" noWrap sx={{ fontWeight: 500 }}>
            {activeProjectName ?? SECTION_LABELS[activeSection]}
          </Typography>
        </Stack>

        <Box sx={{ gridArea: "search", justifySelf: "center", width: "100%", maxWidth: 560 }}>
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
                    <SearchIcon sx={{ fontSize: 17 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography
                      component="kbd"
                      color="text.secondary"
                      sx={{
                        px: 0.7,
                        py: 0.2,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 0.5,
                        bgcolor: "var(--rc-surface-3)",
                        fontFamily: "var(--rc-font-mono)",
                        fontSize: 9
                      }}
                    >
                      Ctrl P
                    </Typography>
                  </InputAdornment>
                )
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 32,
                  cursor: "pointer",
                  fontSize: 12,
                  "&:hover fieldset": { borderColor: "primary.main" }
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
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.6}
            sx={{ display: { xs: "none", xl: "flex" }, color: "text.secondary" }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: isFetchingProjects ? "primary.main" : "success.main",
                animation: isFetchingProjects ? "rc-pulse 1.4s ease-in-out infinite" : "none"
              }}
            />
            <Typography noWrap sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5 }}>
              {isFetchingProjects ? "scansione…" : "workspace aggiornato"}
            </Typography>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            color={appUpdateStatus?.updateAvailable ? "primary" : "default"}
            label={`v${APP_VERSION}`}
            sx={{ display: { xs: "none", sm: "flex" } }}
          />
          <Tooltip title={updateTooltip}>
            <span>
              <Badge color="warning" variant="dot" invisible={!canUpdateApp} overlap="rectangular">
                <Button
                  size="small"
                  variant="outlined"
                  color={canUpdateApp ? "primary" : "inherit"}
                  aria-label={getUpdateAriaLabel(appUpdateStatus, canUpdateApp)}
                  startIcon={
                    isUpdatingApp || (isCheckingAppUpdate && !appUpdateStatus)
                      ? <CircularProgress color="inherit" size={14} />
                      : <SyncIcon sx={{ fontSize: 16 }} />
                  }
                  onClick={onUpdateApp}
                  disabled={!canUpdateApp}
                  sx={{
                    minWidth: { xs: 32, sm: 92 },
                    px: { xs: 0.75, sm: 1.25 },
                    "& .MuiButton-startIcon": { ml: 0, mr: { xs: 0, sm: 0.65 } }
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
                  {isFetchingProjects ? <CircularProgress size={17} /> : <RefreshIcon fontSize="small" />}
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
