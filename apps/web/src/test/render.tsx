import { CssBaseline, ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createAppTheme } from "../theme";

// Passed to `render` as a wrapper rather than wrapped around the element, so a `rerender`
// keeps the providers in place instead of dropping the component out of its context.
function withTheme(children: ReactNode) {
  return (
    <ThemeProvider theme={createAppTheme("white")}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function renderWithTheme(element: ReactElement) {
  return render(element, {
    wrapper: ({ children }) => withTheme(children)
  });
}

export function renderWithProviders(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity }
    }
  });

  return {
    ...render(element, {
      wrapper: ({ children }) => withTheme(
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }),
    queryClient
  };
}
