import { Box, CircularProgress, CssBaseline, ThemeProvider, Typography } from "@mui/material";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";
import React from "react";
import { useTranslation } from "react-i18next";
import { isUnauthenticatedError } from "./api/http";
import {
  AUTH_SESSION_QUERY_KEY,
  SIGNED_OUT_SESSION,
  useAuthSession
} from "./components/auth/authSession";
import { LoginPage } from "./components/auth/LoginPage";
import { ProjectsDashboard } from "./components/dashboard/ProjectsDashboard";
import {
  COLOR_PALETTE_STORAGE_KEY,
  createAppTheme,
  getInitialColorPalette
} from "./theme";
import type { ColorPalette } from "./types/common";

// Built per mounted application rather than per module so the cache cannot outlive the
// shell that owns it.
function createAppQueryClient(): QueryClient {
  // A session can lapse under any feature - a page left open overnight, a restarted API -
  // and every one of them would otherwise render a panel of failed requests. Watching the
  // shared cache means one place decides that the answer is the sign-in screen.
  function returnToSignInOnLapsedSession(error: unknown): void {
    if (isUnauthenticatedError(error)) {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, SIGNED_OUT_SESSION);
    }
  }

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: returnToSignInOnLapsedSession }),
    mutationCache: new MutationCache({ onError: returnToSignInOnLapsedSession }),
    defaultOptions: {
      queries: {
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 10 * 1000
      }
    }
  });

  return queryClient;
}

export function App() {
  const [queryClient] = React.useState(createAppQueryClient);
  const [colorPalette, setColorPalette] = React.useState<ColorPalette>(getInitialColorPalette);
  const theme = React.useMemo(() => createAppTheme(colorPalette), [colorPalette]);

  React.useEffect(() => {
    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, colorPalette);
  }, [colorPalette]);

  React.useLayoutEffect(() => {
    const backgroundColor = theme.palette.background.default;
    const previousRootBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = backgroundColor;
    document.body.style.backgroundColor = backgroundColor;

    return () => {
      document.documentElement.style.backgroundColor = previousRootBackground;
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [theme.palette.background.default]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AppShell colorPalette={colorPalette} onColorPaletteChange={setColorPalette} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AppShell({
  colorPalette,
  onColorPaletteChange
}: {
  colorPalette: ColorPalette;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
}) {
  const { data: session, isPending } = useAuthSession();

  if (isPending) {
    return <SignInStateSplash />;
  }

  if (session?.authRequired && !session.authenticated) {
    return <LoginPage />;
  }

  // An unreadable sign-in state falls through to the dashboard on purpose: the API is the
  // only thing that can enforce the gate, and a local tool should not lock its owner out
  // because one request failed. A closed API answers the dashboard's own calls with 401,
  // which brings the sign-in screen back.
  return (
    <ProjectsDashboard
      colorPalette={colorPalette}
      onColorPaletteChange={onColorPaletteChange}
    />
  );
}

function SignInStateSplash() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        minHeight: "100dvh"
      }}
    >
      <CircularProgress size={22} />
      <Typography color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5 }}>
        {t("auth.boot.loading")}
      </Typography>
    </Box>
  );
}
