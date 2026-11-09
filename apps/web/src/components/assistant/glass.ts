import { alpha, type Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

// The glass language of the AI-first design: translucent panels over the page glow, a
// hairline border and a soft top highlight. Derived from the active palette, so it reads
// on the light palette as well as on the dark ones it was designed on.

export function glassSurface(theme: Theme, strength: "soft" | "strong" = "soft"): SystemStyleObject<Theme> {
  const isLight = theme.palette.mode === "light";
  const fill = strength === "strong" ? (isLight ? 0.82 : 0.62) : isLight ? 0.68 : 0.42;
  return {
    bgcolor: alpha(theme.palette.background.paper, fill),
    border: `1px solid ${alpha(theme.palette.text.primary, isLight ? 0.1 : 0.12)}`,
    backdropFilter: "blur(22px) saturate(150%)",
    WebkitBackdropFilter: "blur(22px) saturate(150%)",
    boxShadow: `inset 0 1px 0 ${alpha("#ffffff", isLight ? 0.6 : 0.07)}${strength === "strong" ? `, 0 24px 60px ${alpha("#000000", isLight ? 0.1 : 0.35)}` : ""}`
  };
}

/** The accent gradient used by the send button and the agent orb. */
export function accentGradient(theme: Theme): string {
  return `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`;
}

export function orbGradient(theme: Theme): string {
  return `radial-gradient(circle at 30% 30%, #ffffff, ${theme.palette.primary.main} 40%, ${theme.palette.info.main} 78%, ${alpha(theme.palette.info.main, 0)} 100%)`;
}

/** Visually hidden but read by screen readers. Pixel units on purpose: in MUI's sx a bare 1 means 100%. */
export const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap"
} as const;
