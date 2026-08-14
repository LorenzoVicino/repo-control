import { alpha, createTheme } from "@mui/material";
import type { ColorMode, ColorPalette } from "./types/common";

export const COLOR_PALETTE_STORAGE_KEY = "repo-control-color-palette";
const LEGACY_COLOR_MODE_STORAGE_KEY = "repo-control-color-mode";

export const UI_FONT_FAMILY = 'Inter, "Segoe UI", system-ui, sans-serif';
export const MONO_FONT_FAMILY = '"JetBrains Mono", "SFMono-Regular", Consolas, monospace';

type ThemePaletteTokens = {
  mode: ColorMode;
  background: string;
  surface1: string;
  surface2: string;
  surface3: string;
  divider: string;
  strongDivider: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primary: {
    main: string;
    dark: string;
    light: string;
    contrastText: string;
    tint: string;
  };
};

const DARK_SURFACES = {
  mode: "dark" as const,
  background: "#161826",
  surface1: "#1b1e2d",
  surface2: "#232532",
  surface3: "#2b2e3d",
  divider: "rgba(233, 233, 237, 0.10)",
  strongDivider: "rgba(233, 233, 237, 0.18)",
  textPrimary: "#e9e9ed",
  textSecondary: "#9397ab",
  textTertiary: "#75798c"
};

const COLOR_PALETTE_TOKENS: Record<ColorPalette, ThemePaletteTokens> = {
  white: {
    mode: "light",
    background: "#f3f5fe",
    surface1: "#fdfdff",
    surface2: "#eceffb",
    surface3: "#e4e7f5",
    divider: "rgba(41, 43, 49, 0.12)",
    strongDivider: "rgba(41, 43, 49, 0.22)",
    textPrimary: "#292b31",
    textSecondary: "#595d6c",
    textTertiary: "#75798c",
    primary: {
      main: "#5d5294",
      dark: "#423a6a",
      light: "#796cbf",
      contrastText: "#fdfdff",
      tint: "#e7e5fe"
    }
  },
  black: {
    ...DARK_SURFACES,
    primary: {
      main: "#9184d9",
      dark: "#796cbf",
      light: "#b5abfc",
      contrastText: "#161826",
      tint: "#2b2741"
    }
  },
  red: {
    ...DARK_SURFACES,
    primary: {
      main: "#e0836f",
      dark: "#b75f4c",
      light: "#f2a695",
      contrastText: "#161826",
      tint: "#3d292c"
    }
  },
  blue: {
    ...DARK_SURFACES,
    primary: {
      main: "#74b3d9",
      dark: "#4b8db6",
      light: "#a2d1ed",
      contrastText: "#161826",
      tint: "#223344"
    }
  },
  green: {
    ...DARK_SURFACES,
    primary: {
      main: "#6cc2a1",
      dark: "#489778",
      light: "#99dec3",
      contrastText: "#161826",
      tint: "#213a36"
    }
  }
};

export const COLOR_PALETTE_OPTIONS: ReadonlyArray<{
  id: ColorPalette;
  label: string;
  color: string;
  surface: string;
}> = [
  { id: "white", label: "Bianco", color: "#5d5294", surface: "#fdfdff" },
  { id: "black", label: "Nero", color: "#9184d9", surface: "#161826" },
  { id: "red", label: "Rosso", color: "#e0836f", surface: "#161826" },
  { id: "blue", label: "Blu", color: "#74b3d9", surface: "#161826" },
  { id: "green", label: "Verde", color: "#6cc2a1", surface: "#161826" }
];

export function createAppTheme(colorPalette: ColorPalette) {
  const tokens = COLOR_PALETTE_TOKENS[colorPalette];
  const isLight = tokens.mode === "light";
  const semantic = {
    success: isLight ? "#2f7d5f" : "#6cc2a1",
    warning: isLight ? "#8a6118" : "#d9a95f",
    error: isLight ? "#a8412c" : "#e0836f",
    info: isLight ? "#2a6b93" : "#74b3d9"
  };

  return createTheme({
    palette: {
      mode: tokens.mode,
      primary: {
        main: tokens.primary.main,
        dark: tokens.primary.dark,
        light: tokens.primary.light,
        contrastText: tokens.primary.contrastText
      },
      secondary: {
        main: isLight ? "#423a6a" : "#a7a1db",
        dark: isLight ? "#2b2741" : "#796cbf",
        light: isLight ? "#796cbf" : "#d2cefd",
        contrastText: isLight ? "#fdfdff" : "#161826"
      },
      success: { main: semantic.success },
      warning: { main: semantic.warning },
      error: { main: semantic.error },
      info: { main: semantic.info },
      background: {
        default: tokens.background,
        paper: tokens.surface1
      },
      text: {
        primary: tokens.textPrimary,
        secondary: tokens.textSecondary,
        disabled: tokens.textTertiary
      },
      divider: tokens.divider,
      action: {
        hover: alpha(tokens.textPrimary, isLight ? 0.045 : 0.055),
        selected: alpha(tokens.primary.main, isLight ? 0.105 : 0.13),
        focus: alpha(tokens.primary.main, 0.2),
        disabled: tokens.textTertiary,
        disabledBackground: tokens.surface2
      }
    },
    shape: { borderRadius: 8 },
    spacing: 8,
    typography: {
      fontFamily: UI_FONT_FAMILY,
      fontSize: 13,
      h1: {
        fontSize: "25px",
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: "-0.02em"
      },
      h2: {
        fontSize: "16px",
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: "-0.012em"
      },
      h3: {
        fontSize: "15px",
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: "-0.01em"
      },
      h4: {
        fontSize: "14px",
        fontWeight: 500,
        lineHeight: 1.25
      },
      h5: {
        fontSize: "21px",
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: "-0.02em"
      },
      h6: {
        fontSize: "13.5px",
        fontWeight: 500,
        lineHeight: 1.3
      },
      subtitle1: {
        fontSize: "13.5px",
        fontWeight: 500,
        lineHeight: 1.4
      },
      subtitle2: {
        fontSize: "12.5px",
        fontWeight: 500,
        lineHeight: 1.4
      },
      body1: {
        fontSize: "13px",
        fontWeight: 400,
        lineHeight: 1.55
      },
      body2: {
        fontSize: "12.5px",
        fontWeight: 400,
        lineHeight: 1.55
      },
      caption: {
        fontSize: "11.5px",
        fontWeight: 400,
        lineHeight: 1.45
      },
      button: {
        fontSize: "12px",
        fontWeight: 500,
        letterSpacing: 0,
        textTransform: "none"
      },
      overline: {
        fontFamily: MONO_FONT_FAMILY,
        fontSize: "9.5px",
        fontWeight: 600,
        lineHeight: 1.7,
        letterSpacing: "0.14em",
        textTransform: "uppercase"
      }
    },
    components: {
      MuiCssBaseline: {
        defaultProps: { enableColorScheme: true },
        styleOverrides: {
          ":root": {
            "--rc-surface-1": tokens.surface1,
            "--rc-surface-2": tokens.surface2,
            "--rc-surface-3": tokens.surface3,
            "--rc-border": tokens.divider,
            "--rc-border-strong": tokens.strongDivider,
            "--rc-text-tertiary": tokens.textTertiary,
            "--rc-accent-tint": tokens.primary.tint,
            "--rc-font-mono": MONO_FONT_FAMILY,
            "--rc-radius-panel": "9px",
            "--rc-radius-control": "7px",
            "--rc-motion-fast": "140ms",
            "--rc-motion-base": "190ms"
          },
          html: {
            backgroundColor: tokens.background,
            scrollBehavior: "smooth"
          },
          body: {
            minWidth: 320,
            backgroundColor: tokens.background,
            color: tokens.textPrimary,
            WebkitFontSmoothing: "antialiased",
            textRendering: "optimizeLegibility"
          },
          "#root": { minHeight: "100dvh" },
          "*, *::before, *::after": { boxSizing: "border-box" },
          "::selection": { backgroundColor: alpha(tokens.primary.main, 0.28) },
          "*": { scrollbarColor: `${alpha(tokens.textSecondary, 0.35)} transparent` },
          "*:focus-visible": {
            outline: `2px solid ${tokens.primary.main}`,
            outlineOffset: 2
          },
          ".rc-mono": { fontFamily: MONO_FONT_FAMILY },
          ".rc-section-label": {
            fontFamily: MONO_FONT_FAMILY,
            fontSize: "9.5px",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: tokens.textTertiary
          },
          "@keyframes rc-pulse": {
            "0%, 100%": { opacity: 0.45, transform: "scale(0.86)" },
            "50%": { opacity: 1, transform: "scale(1)" }
          },
          "@keyframes rc-sweep": {
            "0%": { transform: "translateX(-100%)" },
            "100%": { transform: "translateX(250%)" }
          },
          "@media (prefers-reduced-motion: reduce)": {
            html: { scrollBehavior: "auto" },
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.01ms !important",
              scrollBehavior: "auto !important"
            }
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            boxShadow: "none"
          }
        }
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: { borderColor: tokens.divider }
        }
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${tokens.divider}`,
            borderRadius: 9
          }
        }
      },
      MuiButtonBase: {
        defaultProps: { disableRipple: true }
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 32,
            borderRadius: 7,
            paddingInline: 11,
            transition: "background-color var(--rc-motion-fast) ease, border-color var(--rc-motion-fast) ease, color var(--rc-motion-fast) ease",
            "&:focus-visible": {
              outline: `2px solid ${tokens.primary.main}`,
              outlineOffset: 2
            }
          },
          containedPrimary: {
            color: isLight ? tokens.primary.dark : tokens.primary.light,
            backgroundColor: tokens.primary.tint,
            border: `1px solid ${alpha(tokens.primary.main, 0.78)}`,
            "&:hover": {
              backgroundColor: alpha(tokens.primary.main, isLight ? 0.17 : 0.2),
              borderColor: tokens.primary.main,
              boxShadow: "none"
            }
          },
          outlined: {
            borderColor: tokens.strongDivider,
            "&:hover": {
              borderColor: tokens.primary.main,
              backgroundColor: alpha(tokens.primary.main, 0.08)
            }
          },
          text: {
            "&:hover": { backgroundColor: alpha(tokens.textPrimary, 0.055) }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: 32,
            height: 32,
            borderRadius: 7,
            transition: "background-color var(--rc-motion-fast) ease, color var(--rc-motion-fast) ease",
            "&:focus-visible": {
              outline: `2px solid ${tokens.primary.main}`,
              outlineOffset: 2
            }
          },
          sizeSmall: { width: 28, height: 28 }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            height: 23,
            borderRadius: 4,
            fontFamily: MONO_FONT_FAMILY,
            fontSize: "10.5px",
            fontWeight: 500
          },
          sizeSmall: { height: 21 },
          label: { paddingInline: 7 },
          outlined: { borderColor: tokens.strongDivider }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 34,
            borderRadius: 7,
            backgroundColor: tokens.surface2,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: tokens.divider },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: tokens.strongDivider },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.primary.main,
              borderWidth: 1
            }
          },
          input: { paddingTop: 8, paddingBottom: 8 },
          inputSizeSmall: { paddingTop: 7, paddingBottom: 7 }
        }
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: "12px" } }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            minWidth: 32,
            minHeight: 32,
            padding: 5,
            borderColor: tokens.divider,
            color: tokens.textSecondary,
            "&.Mui-selected": {
              color: tokens.primary.light,
              backgroundColor: tokens.primary.tint
            }
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            height: 44,
            borderColor: tokens.divider,
            padding: "8px 12px"
          },
          head: {
            height: 34,
            color: tokens.textTertiary,
            fontFamily: MONO_FONT_FAMILY,
            fontSize: "9.5px",
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            backgroundColor: tokens.surface2
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 42 },
          indicator: { height: 2, borderRadius: "2px 2px 0 0" }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 42,
            minWidth: 72,
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: 0,
            textTransform: "none"
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.strongDivider}`,
            borderRadius: 12,
            backgroundColor: tokens.surface1,
            boxShadow: isLight
              ? "0 30px 80px rgba(41, 43, 49, 0.22)"
              : "0 30px 80px rgba(0, 0, 0, 0.60)"
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: "16px", fontWeight: 500 } }
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${tokens.strongDivider}`,
            borderRadius: 9,
            boxShadow: isLight
              ? "0 18px 48px rgba(41, 43, 49, 0.18)"
              : "0 18px 48px rgba(0, 0, 0, 0.48)"
          }
        }
      },
      MuiMenuItem: {
        styleOverrides: { root: { minHeight: 34, borderRadius: 7, fontSize: "12.5px" } }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            border: `1px solid ${tokens.strongDivider}`,
            borderRadius: 5,
            backgroundColor: tokens.surface3,
            color: tokens.textPrimary,
            fontSize: "11px"
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            border: `1px solid ${tokens.divider}`,
            backgroundImage: "none"
          }
        }
      }
    }
  });
}

export function getInitialColorPalette(): ColorPalette {
  const storedPalette = window.localStorage.getItem(COLOR_PALETTE_STORAGE_KEY);

  if (COLOR_PALETTE_OPTIONS.some((option) => option.id === storedPalette)) {
    return storedPalette as ColorPalette;
  }

  const legacyMode = window.localStorage.getItem(LEGACY_COLOR_MODE_STORAGE_KEY);
  if (legacyMode === "light") return "white";
  if (legacyMode === "dark") return "black";

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "black" : "white";
}
