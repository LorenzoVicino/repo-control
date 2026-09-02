import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  alpha,
  Box,
  ButtonBase,
  CircularProgress,
  Divider,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "../../api/auth";
import { COLOR_PALETTE_OPTIONS } from "../../theme";
import type { ColorPalette } from "../../types/common";
import { AUTH_SESSION_QUERY_KEY, useAuthSession } from "./authSession";

type ProfileMenuProps = {
  collapsed: boolean;
  colorPalette: ColorPalette;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
  onOpenSettings: () => void;
};

// The menu shows one of two panels rather than a nested submenu: palettes are a five-item
// list, and swapping the panel keeps focus and keyboard order inside a single popover.
type MenuPanel = "profile" | "appearance";

// Sits in the sidebar footer and is the only way to reach the account, the palettes and
// the settings section. It renders whether or not the server asks for credentials: with no
// session there is nothing to sign out of, but there are still preferences to open.
export function ProfileMenu({
  collapsed,
  colorPalette,
  onColorPaletteChange,
  onOpenSettings
}: ProfileMenuProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = useAuthSession();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(null);
  const [panel, setPanel] = React.useState<MenuPanel>("profile");
  const menuId = React.useId();

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: (nextSession) => {
      setAnchorElement(null);
      // Publishing the ended session first is what swaps the sign-in screen in and unmounts
      // the dashboard. The workspace answers behind it were read with that session, so they
      // go too - every key except this one, because clearing the whole cache would detach
      // the mounted observer reading it and the shell would never see the new state.
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, nextSession);
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== AUTH_SESSION_QUERY_KEY[0]
      });
    }
  });

  const hasSession = Boolean(session?.authRequired && session.authenticated);
  const username = session?.username ?? "";
  const displayName = hasSession && username ? username : t("auth.session.localAccount");
  const activePalette = COLOR_PALETTE_OPTIONS.find((option) => option.id === colorPalette)
    ?? COLOR_PALETTE_OPTIONS[0];
  const activePaletteLabel = t(`appearance.palettes.${activePalette.id}.label`);
  const buttonLabel = hasSession && username
    ? t("auth.session.menuAriaLabel", { username })
    : t("auth.session.profileMenuAriaLabel");

  function closeMenu() {
    setAnchorElement(null);
  }

  return (
    <>
      <Tooltip title={collapsed ? displayName : ""} placement="right">
        <ButtonBase
          data-testid="profile-menu-trigger"
          onClick={(event) => {
            setPanel("profile");
            setAnchorElement(event.currentTarget);
          }}
          aria-label={buttonLabel}
          aria-haspopup="menu"
          aria-controls={anchorElement ? menuId : undefined}
          aria-expanded={Boolean(anchorElement)}
          sx={{
            width: "100%",
            minHeight: collapsed ? 38 : 46,
            px: collapsed ? 0 : 1,
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 1,
            border: "1px solid",
            borderColor: anchorElement ? "primary.main" : "transparent",
            borderRadius: "var(--rc-radius-control)",
            color: "text.secondary",
            bgcolor: anchorElement ? "var(--rc-accent-tint)" : "transparent",
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
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              border: "1px solid",
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.4),
              borderRadius: "50%",
              color: "primary.main",
              bgcolor: "var(--rc-accent-tint)",
              fontFamily: "var(--rc-font-mono)",
              fontSize: 10.5,
              fontWeight: 600
            }}
          >
            {hasSession && username
              ? username.slice(0, 1).toUpperCase()
              : <PersonOutlineRoundedIcon sx={{ fontSize: 15 }} />}
          </Box>
          {collapsed ? null : (
            <Box sx={{ minWidth: 0, textAlign: "left" }}>
              <Typography component="div" variant="overline" color="text.disabled" sx={{ lineHeight: 1.15 }}>
                {t("auth.session.profile")}
              </Typography>
              <Typography
                component="div"
                variant="body2"
                noWrap
                sx={{ mt: 0.2, maxWidth: 132, fontWeight: 500, color: "text.primary" }}
              >
                {displayName}
              </Typography>
            </Box>
          )}
          {collapsed ? null : (
            <KeyboardArrowUpRoundedIcon
              fontSize="small"
              sx={{
                ml: "auto",
                transform: anchorElement ? "rotate(180deg)" : "none",
                transition: "transform 160ms ease"
              }}
            />
          )}
        </ButtonBase>
      </Tooltip>

      <Menu
        id={menuId}
        anchorEl={anchorElement}
        open={Boolean(anchorElement)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{
          list: {
            "aria-label": panel === "appearance"
              ? t("navigation.paletteMenu")
              : t("auth.session.profileMenu"),
            sx: { p: 0.75, minWidth: 236 }
          },
          paper: {
            sx: { ml: 0.75, mb: 0.75, border: "1px solid", borderColor: "divider" }
          }
        }}
      >
        {panel === "profile"
          ? [
            <ListSubheader
              key="identity"
              disableSticky
              sx={{ px: 1.25, py: 0.75, bgcolor: "transparent", lineHeight: 1.25 }}
            >
              <Typography variant="overline" color="text.disabled" component="div">
                {hasSession ? t("auth.session.signedInAs") : t("auth.session.localMode")}
              </Typography>
              <Typography
                noWrap
                component="div"
                sx={{ mt: 0.2, color: "text.primary", fontFamily: "var(--rc-font-mono)", fontSize: 11.5, fontWeight: 500 }}
              >
                {displayName}
              </Typography>
              {hasSession ? null : (
                <Typography color="text.secondary" sx={{ mt: 0.35, fontSize: 10.5, whiteSpace: "normal" }}>
                  {t("auth.session.localModeDescription")}
                </Typography>
              )}
            </ListSubheader>,

            <Divider key="identity-divider" sx={{ my: 0.5 }} />,

            <MenuItem
              key="settings"
              onClick={() => {
                onOpenSettings();
                closeMenu();
              }}
              sx={{ gap: 1.25 }}
            >
              <SettingsOutlinedIcon sx={{ fontSize: 17 }} />
              {t("navigation.sections.settings")}
            </MenuItem>,

            <MenuItem
              key="appearance"
              onClick={() => setPanel("appearance")}
              aria-label={t("navigation.selectPalette", { palette: activePaletteLabel })}
              aria-haspopup="menu"
              sx={{ gap: 1.25 }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 17,
                  height: 17,
                  flexShrink: 0,
                  border: "1px solid var(--rc-border-strong)",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${activePalette.surface} 0 50%, ${activePalette.color} 50% 100%)`
                }}
              />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>{t("navigation.appearance")}</Box>
              <Typography component="span" color="text.disabled" sx={{ fontSize: 10.5 }}>
                {activePaletteLabel}
              </Typography>
              <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
            </MenuItem>,

            ...(hasSession
              ? [
                <Divider key="session-divider" sx={{ my: 0.5 }} />,

                <MenuItem
                  key="sign-out"
                  disabled={signOutMutation.isPending}
                  onClick={() => signOutMutation.mutate()}
                  sx={{ gap: 1.25 }}
                >
                  {signOutMutation.isPending
                    ? <CircularProgress color="inherit" size={15} />
                    : <LogoutRoundedIcon sx={{ fontSize: 17 }} />}
                  {signOutMutation.isPending ? t("auth.session.signingOut") : t("auth.session.signOut")}
                </MenuItem>,

                ...(signOutMutation.isError
                  ? [
                    <Typography key="sign-out-error" color="error.main" sx={{ px: 1.5, pb: 1, fontSize: 10.5 }}>
                      {t("auth.session.signOutError")}
                    </Typography>
                  ]
                  : [])
              ]
              : [])
          ]
          : [
            <MenuItem key="back" onClick={() => setPanel("profile")} sx={{ gap: 1.25 }}>
              <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>{t("navigation.appearanceMenuTitle")}</Box>
            </MenuItem>,

            <Divider key="appearance-divider" sx={{ my: 0.5 }} />,

            ...COLOR_PALETTE_OPTIONS.map((option) => {
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
                    closeMenu();
                  }}
                  sx={{ minHeight: 44, borderRadius: 0.75, gap: 1.25 }}
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
                  <Stack sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography variant="body2" fontWeight={isSelected ? 600 : 500}>
                      {t(`appearance.palettes.${option.id}.label`)}
                    </Typography>
                    <Typography component="div" color="text.disabled" sx={{ mt: 0.1, fontSize: 10 }}>
                      {t(`appearance.palettes.${option.id}.description`)}
                    </Typography>
                  </Stack>
                  {isSelected ? <CheckRoundedIcon color="primary" fontSize="small" /> : null}
                </MenuItem>
              );
            })
          ]}
      </Menu>
    </>
  );
}
