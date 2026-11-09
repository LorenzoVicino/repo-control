import type { Theme } from "@mui/material/styles";
import type { GraphColors } from "./graphModel";

/**
 * Node and edge colours from the active palette: repositories by kind, relations by type.
 * WebGL blends translucent colours toward white on a dark ground, so muted elements use
 * solid colours instead of alpha.
 */
export function graphColors(theme: Theme): GraphColors {
  const { palette } = theme;
  return {
    repository: {
      default: palette.primary.light,
      "web app": palette.primary.main,
      api: palette.info.main,
      library: palette.success.main,
      cli: palette.warning.main,
      monorepo: palette.secondary.main,
      mobile: "#ec4899",
      documentation: palette.text.secondary,
      infrastructure: palette.warning.dark,
      "data & ml": "#a78bfa"
    },
    label: palette.mode === "light" ? "#a3a9b8" : "#5d6478",
    edges: {
      depends_on: palette.warning.main,
      references: palette.info.main,
      similar: "#ec4899",
      labelled: palette.mode === "light" ? "#dde0e7" : "#2e3343"
    }
  };
}
