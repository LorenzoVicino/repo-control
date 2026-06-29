import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ProjectsDashboard } from "./components/dashboard/ProjectsDashboard";
import { COLOR_MODE_STORAGE_KEY, createAppTheme, getInitialColorMode } from "./theme";
import type { ColorMode } from "./types";

const queryClient = new QueryClient();

export function App() {
  const [colorMode, setColorMode] = React.useState<ColorMode>(getInitialColorMode);
  const theme = React.useMemo(() => createAppTheme(colorMode), [colorMode]);

  React.useEffect(() => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, colorMode);
  }, [colorMode]);

  function toggleColorMode() {
    setColorMode((currentMode) => (currentMode === "light" ? "dark" : "light"));
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <ProjectsDashboard colorMode={colorMode} onToggleColorMode={toggleColorMode} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
