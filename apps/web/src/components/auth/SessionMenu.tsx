import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { signOut } from "../../api/auth";
import { AUTH_SESSION_QUERY_KEY, useAuthSession } from "./authSession";

// Renders nothing when the server has no credentials configured: there is no session to
// show and no way to end one.
export function SessionMenu() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = useAuthSession();
  const [anchorElement, setAnchorElement] = React.useState<HTMLElement | null>(null);

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

  if (!session?.authRequired || !session.authenticated) {
    return null;
  }

  const username = session.username ?? "";
  const menuAriaLabel = t("auth.session.menuAriaLabel", { username });

  return (
    <>
      <Tooltip title={menuAriaLabel}>
        <IconButton
          size="small"
          aria-label={menuAriaLabel}
          aria-haspopup="menu"
          aria-expanded={Boolean(anchorElement)}
          onClick={(event) => setAnchorElement(event.currentTarget)}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            color: "primary.main",
            bgcolor: "var(--rc-accent-tint)",
            fontFamily: "var(--rc-font-mono)",
            fontSize: 11,
            fontWeight: 600
          }}
        >
          {username.slice(0, 1).toUpperCase() || "?"}
        </IconButton>
      </Tooltip>

      <Menu
        open={Boolean(anchorElement)}
        anchorEl={anchorElement}
        onClose={() => setAnchorElement(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { minWidth: 216 } } }}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="overline" color="text.disabled" sx={{ display: "block" }}>
            {t("auth.session.signedInAs")}
          </Typography>
          <Typography noWrap sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 11.5, fontWeight: 500 }}>
            {username}
          </Typography>
        </Box>

        <Divider />

        <MenuItem
          disabled={signOutMutation.isPending}
          onClick={() => signOutMutation.mutate()}
          sx={{ mx: 0.75, my: 0.5, gap: 1.25 }}
        >
          {signOutMutation.isPending
            ? <CircularProgress color="inherit" size={15} />
            : <LogoutRoundedIcon sx={{ fontSize: 17 }} />}
          {signOutMutation.isPending ? t("auth.session.signingOut") : t("auth.session.signOut")}
        </MenuItem>

        {signOutMutation.isError ? (
          <Typography color="error.main" sx={{ px: 1.5, pb: 1, fontSize: 10.5 }}>
            {t("auth.session.signOutError")}
          </Typography>
        ) : null}
      </Menu>
    </>
  );
}
