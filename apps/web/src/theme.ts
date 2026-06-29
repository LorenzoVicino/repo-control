import { createTheme } from "@mui/material";
import type { ColorMode } from "./types";

export const COLOR_MODE_STORAGE_KEY = "repo-control-color-mode";

export function createAppTheme(colorMode: ColorMode) {
  return createTheme({
    palette: {
      mode: colorMode,
      primary: {
        main: colorMode === "light" ? "#2563eb" : "#7aa2ff"
      },
      background: {
        default: colorMode === "light" ? "#f6f8fa" : "#0f141b",
        paper: colorMode === "light" ? "#ffffff" : "#171c24"
      }
    },
    shape: {
      borderRadius: 6
    },
    typography: {
      h1: {
        fontSize: "1.2rem",
        fontWeight: 700
      },
      h2: {
        fontSize: "1rem",
        fontWeight: 700
      }
    }
  });
}

export function getInitialColorMode(): ColorMode {
  const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);

  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
