import { alpha, useMediaQuery, useTheme } from "@mui/material";
import { animate } from "motion/mini";
import React from "react";

export function AppMotionBackdrop() {
  const theme = useTheme();
  const shouldReduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", {
    noSsr: true
  });
  const scopeRef = React.useRef<HTMLDivElement>(null);
  const isLight = theme.palette.mode === "light";
  const gridColor = alpha(theme.palette.primary.main, isLight ? 0.11 : 0.135);

  React.useEffect(() => {
    const scope = scopeRef.current;
    const signalLayer = scope?.querySelector<HTMLElement>(
      '[data-app-motion-layer="signal"]'
    );
    if (shouldReduceMotion || !signalLayer) return;

    const signalSweep = animate(
      signalLayer,
      {
        opacity: [0, 1, 1, 0],
        transform: [
          "translate3d(-35%, -5%, 0) rotate(-10deg)",
          "translate3d(90%, 0%, 0) rotate(-10deg)",
          "translate3d(270%, 6%, 0) rotate(-10deg)",
          "translate3d(440%, 10%, 0) rotate(-10deg)"
        ]
      },
      {
        duration: 7,
        ease: "easeInOut",
        repeat: Infinity
      }
    );
    signalSweep.time = 1.75;

    return () => {
      signalSweep.cancel();
    };
  }, [shouldReduceMotion]);

  return (
    <div
      ref={scopeRef}
      aria-hidden="true"
      data-app-motion-backdrop
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        contain: "layout paint style",
        isolation: "isolate"
      }}
    >
      <div
        data-app-motion-grid
        style={{
          position: "absolute",
          inset: "-12%",
          opacity: isLight ? 0.84 : 0.7,
          backgroundImage: [
            `linear-gradient(${gridColor} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`
          ].join(","),
          backgroundSize: "52px 52px",
          maskImage:
            "radial-gradient(ellipse 82% 72% at 50% 20%, black 4%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 82% 72% at 50% 20%, black 4%, transparent 78%)"
        }}
      />

      <div
        data-app-motion-layer="signal"
        style={{
          position: "absolute",
          top: "-18%",
          left: "-30%",
          width: "max(520px, 48vw)",
          height: "136%",
          borderRadius: "48%",
          opacity: 0,
          transform: "translate3d(-35%, -5%, 0) rotate(-10deg)",
          willChange: shouldReduceMotion ? "auto" : "transform, opacity",
          background: `radial-gradient(ellipse at center, ${alpha(
            theme.palette.primary.main,
            isLight ? 0.44 : 0.52
          )} 0%, ${alpha(theme.palette.secondary.main, isLight ? 0.22 : 0.3)} 36%, transparent 72%)`
        }}
      />
    </div>
  );
}
