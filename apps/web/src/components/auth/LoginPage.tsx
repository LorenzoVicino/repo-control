import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LoginRoundedIcon from "@mui/icons-material/LoginRounded";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  alpha,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import React from "react";
import { useTranslation } from "react-i18next";
import { fetchApiHealth, signIn } from "../../api/auth";
import { ApiError } from "../../api/http";
import { APP_VERSION } from "../../config";
import type { AuthSession } from "../../types/auth";
import { AUTH_SESSION_QUERY_KEY } from "./authSession";
import { LoginShowcase } from "./LoginShowcase";

const API_HEALTH_POLL_INTERVAL_MS = 20 * 1000;

// Loaded the same way the dashboard loads it, so the shared backdrop stays in its own chunk
// instead of being pulled into the entry bundle by this screen.
const AppMotionBackdrop = React.lazy(async () => {
  const module = await import("../dashboard/AppMotionBackdrop");
  return { default: module.AppMotionBackdrop };
});

export function LoginPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const [isCredentialHintOpen, setIsCredentialHintOpen] = React.useState(false);
  const [incompleteFormError, setIncompleteFormError] = React.useState<string | null>(null);

  // The sign-in screen is the one surface that renders while the rest of the API is closed,
  // so it reports whether the local API answers at all: a wrong password and a server that
  // is not running are otherwise indistinguishable from here.
  const apiHealth = useQuery({
    queryKey: ["api-health"],
    queryFn: fetchApiHealth,
    refetchInterval: API_HEALTH_POLL_INTERVAL_MS,
    retry: false
  });

  const signInMutation = useMutation({
    mutationFn: (): Promise<AuthSession> => signIn({ username: username.trim(), password, remember }),
    onSuccess: (session) => {
      setPassword("");
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, session);
    }
  });

  const errorMessage = incompleteFormError ?? getSignInErrorMessage(signInMutation.error, t);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    if (!username.trim() || !password) {
      signInMutation.reset();
      setIncompleteFormError(t("auth.errors.missingFields"));
      return;
    }

    setIncompleteFormError(null);
    signInMutation.mutate();
  }

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        px: { xs: 2, sm: 3, lg: 5 },
        py: { xs: 2.5, lg: 3.5 },
        overflow: "hidden"
      }}
    >
      <React.Suspense fallback={null}>
        <AppMotionBackdrop />
      </React.Suspense>
      <Box
        aria-hidden="true"
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: (theme) =>
            `radial-gradient(64% 52% at 24% 26%, ${alpha(theme.palette.primary.main, 0.13)}, transparent 68%)`
        }}
      />

      <Stack
        direction="row"
        spacing={1.25}
        alignItems="center"
        sx={{ position: "relative", zIndex: 1, flexShrink: 0 }}
      >
        <Box
          component="img"
          src="/icon/repo-control-icon-medium.svg"
          alt=""
          aria-hidden="true"
          sx={{ width: 38, height: 38, borderRadius: 1.25 }}
        />
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
            repo-control
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10, letterSpacing: "0.04em" }}
          >
            local · v{APP_VERSION}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          position: "relative",
          zIndex: 1,
          display: "grid",
          flexGrow: 1,
          alignItems: "center",
          gap: { xs: 4, lg: 6, xl: 9 },
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(360px, 430px)" },
          width: "100%",
          maxWidth: 1280,
          mx: "auto",
          py: { xs: 4, lg: 2 }
        }}
      >
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <LoginShowcase />
        </Box>

        <Stack spacing={1.75} sx={{ width: "100%", maxWidth: 430, mx: "auto" }}>
          <Paper
            component="form"
            noValidate
            onSubmit={handleSubmit}
            variant="outlined"
            aria-labelledby="login-title"
            sx={{
              p: { xs: 2.25, sm: 3.25 },
              borderColor: "var(--rc-border-strong)",
              borderRadius: 2,
              bgcolor: "background.paper",
              boxShadow: (theme) =>
                theme.palette.mode === "light"
                  ? "0 24px 64px rgba(41, 43, 49, 0.14)"
                  : "0 24px 64px rgba(0, 0, 0, 0.42)"
            }}
          >
            <Typography variant="overline" color="primary.main" sx={{ display: "block", mb: 0.25 }}>
              {t("auth.eyebrow")}
            </Typography>
            <Typography id="login-title" component="h1" variant="h5">
              {t("auth.title")}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.9, fontSize: 12.5, lineHeight: 1.6 }}>
              {t("auth.description")}
            </Typography>

            <Stack spacing={1.75} sx={{ mt: 2.75 }}>
              <Box>
                <Typography
                  component="label"
                  htmlFor="login-username"
                  variant="subtitle2"
                  sx={{ display: "block", mb: 0.7 }}
                >
                  {t("auth.usernameLabel")}
                </Typography>
                <TextField
                  id="login-username"
                  fullWidth
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={t("auth.usernamePlaceholder")}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    )
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { minHeight: 42 } }}
                />
              </Box>

              <Box>
                <Typography
                  component="label"
                  htmlFor="login-password"
                  variant="subtitle2"
                  sx={{ display: "block", mb: 0.7 }}
                >
                  {t("auth.passwordLabel")}
                </Typography>
                <TextField
                  id="login-password"
                  fullWidth
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}>
                          <Button
                            type="button"
                            size="small"
                            variant="text"
                            color="inherit"
                            aria-label={isPasswordVisible ? t("auth.hidePassword") : t("auth.showPassword")}
                            aria-pressed={isPasswordVisible}
                            onClick={() => setIsPasswordVisible((visible) => !visible)}
                            sx={{ minWidth: 30, minHeight: 30, px: 0.5, color: "text.secondary" }}
                          >
                            {isPasswordVisible
                              ? <VisibilityOffOutlinedIcon sx={{ fontSize: 18 }} />
                              : <VisibilityOutlinedIcon sx={{ fontSize: 18 }} />}
                          </Button>
                        </Tooltip>
                      </InputAdornment>
                    )
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { minHeight: 42 } }}
                />
              </Box>

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                sx={{ gap: 0.5 }}
              >
                {/* describeChild keeps the hint as a description: without it MUI would set
                    aria-label on the label element and rename the checkbox itself. */}
                <Tooltip title={t("auth.rememberHint")} describeChild>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={remember}
                        onChange={(event) => setRemember(event.target.checked)}
                      />
                    }
                    label={<Typography variant="body2">{t("auth.remember")}</Typography>}
                    sx={{ m: 0 }}
                  />
                </Tooltip>
                <Button
                  type="button"
                  size="small"
                  variant="text"
                  aria-expanded={isCredentialHintOpen}
                  onClick={() => setIsCredentialHintOpen((open) => !open)}
                  sx={{ px: 0.75, color: "primary.main", fontWeight: 500 }}
                >
                  {t("auth.forgotCredentials")}
                </Button>
              </Stack>

              <Collapse in={isCredentialHintOpen} unmountOnExit>
                <Box
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "var(--rc-radius-control)",
                    bgcolor: "var(--rc-surface-2)"
                  }}
                >
                  <Typography variant="subtitle2">{t("auth.credentialSourceTitle")}</Typography>
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5, fontFamily: "var(--rc-font-mono)", fontSize: 10.5, lineHeight: 1.7 }}
                  >
                    {t("auth.credentialSourceBody")}
                  </Typography>
                </Box>
              </Collapse>

              {errorMessage ? (
                <Alert severity="error" variant="outlined" sx={{ alignItems: "center", fontSize: 12 }}>
                  {errorMessage}
                </Alert>
              ) : null}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={signInMutation.isPending}
                startIcon={
                  signInMutation.isPending
                    ? <CircularProgress color="inherit" size={15} />
                    : <LoginRoundedIcon sx={{ fontSize: 17 }} />
                }
                sx={{ position: "relative", minHeight: 42, fontSize: 13, fontWeight: 500 }}
              >
                {signInMutation.isPending ? t("auth.submitting") : t("auth.submit")}
                <Typography
                  aria-hidden="true"
                  component="kbd"
                  sx={{
                    position: "absolute",
                    right: 10,
                    px: 0.7,
                    py: 0.2,
                    display: { xs: "none", sm: "block" },
                    border: "1px solid",
                    borderColor: "currentColor",
                    borderRadius: 0.5,
                    opacity: 0.65,
                    fontFamily: "var(--rc-font-mono)",
                    fontSize: 9
                  }}
                >
                  {t("auth.submitKey")}
                </Typography>
              </Button>
            </Stack>

            <Divider sx={{ mt: 2.75, mb: 1.75 }}>
              <Typography variant="overline" color="text.disabled">
                {t("auth.localOnly")}
              </Typography>
            </Divider>

            <Typography color="text.secondary" sx={{ fontSize: 11, lineHeight: 1.6 }}>
              {t("auth.localOnlyNote")}
            </Typography>
          </Paper>

          <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
            <Box
              aria-hidden="true"
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: apiHealth.isPending
                  ? "text.disabled"
                  : apiHealth.isError
                    ? "error.main"
                    : "success.main",
                animation: apiHealth.isPending ? "rc-pulse 1.4s ease-in-out infinite" : "none"
              }}
            />
            <Typography
              color="text.secondary"
              sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 9.5, letterSpacing: "0.04em" }}
            >
              {apiHealth.isPending
                ? t("auth.status.checking")
                : apiHealth.isError
                  ? t("auth.status.offline")
                  : t("auth.status.online")}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

// The server answers in English by design, so the codes it attaches are what the interface
// translates; an unrecognized failure falls back to the message it sent.
function getSignInErrorMessage(error: unknown, t: TFunction): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    if (error.code === "INVALID_CREDENTIALS") return t("auth.errors.invalidCredentials");
    if (error.code === "AUTH_DISABLED") return t("auth.errors.disabled");

    if (error.code === "TOO_MANY_ATTEMPTS") {
      return t("auth.errors.tooManyAttempts", { seconds: readRetryAfterSeconds(error.payload) });
    }
  }

  return error instanceof Error && error.message ? error.message : t("auth.errors.unknown");
}

function readRetryAfterSeconds(payload: unknown): number {
  if (typeof payload === "object" && payload !== null && "retryAfterSeconds" in payload) {
    const seconds = (payload as { retryAfterSeconds: unknown }).retryAfterSeconds;

    if (typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0) {
      return Math.ceil(seconds);
    }
  }

  return 30;
}
