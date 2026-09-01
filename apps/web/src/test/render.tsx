import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createAppTheme } from "../theme";

export function renderWithTheme(element: ReactElement) {
  return render(
    <ThemeProvider theme={createAppTheme("white")}>
      <CssBaseline />
      {element}
    </ThemeProvider>
  );
}

export function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity }
    }
  });

  return {
    ...renderWithTheme(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>),
    queryClient
  };
}
