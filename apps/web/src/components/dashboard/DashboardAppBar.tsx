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
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { APP_VERSION } from "../../config";
import type { AppUpdateStatus } from "../../types/app";
import type { ViewMode } from "../../types/common";
import type { DashboardSection } from "./DashboardSidebar";

const SECTION_LABEL_KEYS: Record<DashboardSection, `navigation.sections.${DashboardSection}`> = {
  overview: "navigation.sections.overview",
  tasks: "navigation.sections.tasks",
  agents: "navigation.sections.agents",
  automations: "navigation.sections.automations",
  docker: "navigation.sections.docker",
  favorites: "navigation.sections.favorites",
  repositories: "navigation.sections.repositories",
  settings: "navigation.sections.settings"
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
  // Owned by the auth feature, which reads the session itself; the bar only gives it a
  // place to sit so this component keeps no data dependency of its own.
  sessionMenu?: ReactNode;
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
  sessionMenu,
  onOpenMobileNavigation,
  onOpenSearch,
  onUpdateApp,
  onViewModeChange,
  onRefreshProjects
}: DashboardAppBarProps) {
  const { t } = useTranslation();
  const canUpdateApp = Boolean(appUpdateStatus?.updateAvailable) && !isUpdatingApp;
  const isLoadingUpdateStatus = isLoadingAppUpdateStatus || (isCheckingAppUpdate && !appUpdateStatus);
  const updateTooltip = isUpdatingApp
    ? t("appBar.updateStatus.updating")
    : isLoadingUpdateStatus
      ? t("appBar.updateStatus.checking")
      : appUpdateStatus?.updateAvailable && appUpdateStatus.latestVersion
        ? t("appBar.updateStatus.available", { version: appUpdateStatus.latestVersion })
        : appUpdateStatus?.error
          ? t("appBar.updateStatus.unavailable", { error: appUpdateStatus.error })
          : appUpdateStatusError instanceof Error
            ? t("appBar.updateStatus.failed", { error: appUpdateStatusError.message })
            : t("appBar.updateStatus.current");
  const updateAriaLabel = canUpdateApp && appUpdateStatus?.latestVersion
    ? t("appBar.updateStatus.updateTo", { version: appUpdateStatus.latestVersion })
    : t("appBar.updateStatus.updateApp");

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
            aria-label={t("appBar.openNavigation")}
            sx={{ display: { xs: "inline-flex", md: "none" }, flexShrink: 0 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="caption" color="text.secondary" noWrap>
            {t("common.workspace")}
          </Typography>
          <Typography aria-hidden="true" variant="caption" color="text.disabled">/</Typography>
          {activeProjectName ? (
            <>
              <Typography variant="caption" color="text.secondary" noWrap>{t("common.repository")}</Typography>
              <Typography aria-hidden="true" variant="caption" color="text.disabled">/</Typography>
            </>
          ) : null}
          <Typography variant="caption" color="text.primary" noWrap sx={{ fontWeight: 500 }}>
            {activeProjectName ?? t(SECTION_LABEL_KEYS[activeSection])}
          </Typography>
        </Stack>

        <Box sx={{ gridArea: "search", justifySelf: "center", width: "100%", maxWidth: 560 }}>
          <Tooltip title={t("appBar.searchTooltip")} placement="bottom">
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
              placeholder={t("appBar.searchPlaceholder")}
              variant="outlined"
              inputProps={{ "aria-label": t("appBar.searchAriaLabel") }}
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
              {isFetchingProjects ? t("appBar.scanning") : t("appBar.workspaceUpdated")}
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
                  aria-label={updateAriaLabel}
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
                  <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                    {t("appBar.update")}
                  </Box>
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
              aria-label={t("appBar.viewMode")}
            >
              <ToggleButton value="map" aria-label={t("appBar.repositoryGrid")}>
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label={t("appBar.tableView")}>
                <TableRowsIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          ) : null}
          {activeSection === "repositories" || activeSection === "favorites" ? (
            <Tooltip title={t("appBar.refreshRepositories")}>
              <span>
                <IconButton
                  onClick={onRefreshProjects}
                  disabled={isFetchingProjects}
                  aria-label={t("appBar.refreshRepositories")}
                  size="small"
                >
                  {isFetchingProjects ? <CircularProgress size={17} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          {sessionMenu}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
