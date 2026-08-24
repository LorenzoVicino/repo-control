import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ProjectsDashboard } from "./components/dashboard/ProjectsDashboard";
import {
  COLOR_PALETTE_STORAGE_KEY,
  createAppTheme,
  getInitialColorPalette
} from "./theme";
import type { ColorPalette } from "./types/common";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 10 * 1000
    }
  }
});

export function App() {
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
        <ProjectsDashboard
          colorPalette={colorPalette}
          onColorPaletteChange={setColorPalette}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
