import { alpha, useTheme } from "@mui/material";

export function AppMotionBackdrop() {
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";
  const gridColor = alpha(theme.palette.text.primary, isLight ? 0.035 : 0.028);

  return (
    <div
      aria-hidden="true"
      data-app-motion-backdrop
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        contain: "layout paint style",
        backgroundImage: [
          `linear-gradient(${gridColor} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`
        ].join(","),
        backgroundSize: "48px 48px",
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 72%)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 72%)"
      }}
    />
  );
}
