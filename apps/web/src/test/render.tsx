import { CssBaseline, ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createAppTheme } from "../theme";

export function renderWithTheme(element: ReactElement) {
  return render(
    <ThemeProvider theme={createAppTheme("light")}>
      <CssBaseline />
      {element}
    </ThemeProvider>
  );
}
