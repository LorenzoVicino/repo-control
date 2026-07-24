import { alpha, createTheme } from "@mui/material";
import type { ColorMode, ColorPalette } from "./types/common";

export const COLOR_PALETTE_STORAGE_KEY = "repo-control-color-palette";
const LEGACY_COLOR_MODE_STORAGE_KEY = "repo-control-color-mode";

type ThemePaletteTokens = {
  mode: ColorMode;
  background: string;
  paper: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  primary: {
    main: string;
    dark: string;
    light: string;
    contrastText: string;
  };
  secondary: {
    main: string;
    dark: string;
    light: string;
    contrastText: string;
  };
  disabledBackground: string;
  outlineHover: string;
  tableHead: string;
};

const COLOR_PALETTE_TOKENS: Record<ColorPalette, ThemePaletteTokens> = {
  white: {
    mode: "light",
    background: "#f6f7f9",
    paper: "#ffffff",
    divider: "#dde1e7",
    textPrimary: "#111318",
    textSecondary: "#606874",
    primary: { main: "#18181b", dark: "#09090b", light: "#52525b", contrastText: "#ffffff" },
    secondary: { main: "#64748b", dark: "#475569", light: "#94a3b8", contrastText: "#ffffff" },
    disabledBackground: "#e9ecf0",
    outlineHover: "#aeb6c2",
    tableHead: "#f7f8fa"
  },
  black: {
    mode: "dark",
    background: "#050608",
    paper: "#0d0f12",
    divider: "#292d33",
    textPrimary: "#fafafa",
    textSecondary: "#a1a1aa",
    primary: { main: "#f4f4f5", dark: "#d4d4d8", light: "#ffffff", contrastText: "#09090b" },
    secondary: { main: "#a1a1aa", dark: "#71717a", light: "#d4d4d8", contrastText: "#09090b" },
    disabledBackground: "#1c1f24",
    outlineHover: "#525760",
    tableHead: "#14171c"
  },
  red: {
    mode: "dark",
    background: "#17080c",
    paper: "#230d13",
    divider: "#4d1d29",
    textPrimary: "#fff1f2",
    textSecondary: "#e7a3b1",
    primary: { main: "#f43f5e", dark: "#e11d48", light: "#fb7185", contrastText: "#ffffff" },
    secondary: { main: "#fb7185", dark: "#f43f5e", light: "#fda4af", contrastText: "#3f0713" },
    disabledBackground: "#3a1620",
    outlineHover: "#7d3043",
    tableHead: "#2d1119"
  },
  blue: {
    mode: "dark",
    background: "#07101f",
    paper: "#0d192b",
    divider: "#20324a",
    textPrimary: "#eaf2ff",
    textSecondary: "#94a8c4",
    primary: { main: "#60a5fa", dark: "#3b82f6", light: "#93c5fd", contrastText: "#07101f" },
    secondary: { main: "#38bdf8", dark: "#0ea5e9", light: "#7dd3fc", contrastText: "#07101f" },
    disabledBackground: "#17243a",
    outlineHover: "#38516f",
    tableHead: "#101f34"
  },
  green: {
    mode: "dark",
    background: "#07150f",
    paper: "#0d2117",
    divider: "#1e4a34",
    textPrimary: "#ecfdf5",
    textSecondary: "#9ac7b1",
    primary: { main: "#34d399", dark: "#10b981", light: "#6ee7b7", contrastText: "#042f20" },
    secondary: { main: "#6ee7b7", dark: "#34d399", light: "#a7f3d0", contrastText: "#042f20" },
    disabledBackground: "#173527",
    outlineHover: "#39745a",
    tableHead: "#102a1d"
  }
};

export const COLOR_PALETTE_OPTIONS: ReadonlyArray<{
  id: ColorPalette;
  label: string;
  color: string;
  surface: string;
}> = [
  { id: "white", label: "Bianco", color: "#18181b", surface: "#ffffff" },
  { id: "black", label: "Nero", color: "#f4f4f5", surface: "#050608" },
  { id: "red", label: "Rosso", color: "#f43f5e", surface: "#17080c" },
  { id: "blue", label: "Blu", color: "#60a5fa", surface: "#07101f" },
  { id: "green", label: "Verde", color: "#34d399", surface: "#07150f" }
];

export function createAppTheme(colorPalette: ColorPalette) {
  const tokens = COLOR_PALETTE_TOKENS[colorPalette];
  const isLight = tokens.mode === "light";
  const {
    background,
    paper,
    divider,
    textPrimary,
    textSecondary
  } = tokens;

  return createTheme({
    palette: {
      mode: tokens.mode,
      primary: tokens.primary,
      secondary: tokens.secondary,
      info: {
        main: isLight ? "#0284c7" : "#38bdf8"
      },
      success: {
        main: isLight ? "#059669" : "#34d399"
      },
      warning: {
        main: isLight ? "#d97706" : "#fbbf24"
      },
      error: {
        main: isLight ? "#dc2626" : "#fb7185"
      },
      background: {
        default: background,
        paper
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary
      },
      divider,
      action: {
        hover: alpha(tokens.primary.main, isLight ? 0.055 : 0.09),
        selected: alpha(tokens.primary.main, isLight ? 0.1 : 0.16),
        focus: alpha(tokens.primary.main, 0.16),
        disabledBackground: tokens.disabledBackground
      }
    },
    shape: {
      borderRadius: 8
    },
    typography: {
      fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h1: {
        fontSize: "1.5rem",
        fontWeight: 750,
        lineHeight: 1.2
      },
      h2: {
        fontSize: "1rem",
        fontWeight: 750,
        lineHeight: 1.3
      },
      h5: {
        fontSize: "1.25rem",
        fontWeight: 750,
        lineHeight: 1.25
      },
      h6: {
        fontSize: "1rem",
        fontWeight: 700,
        lineHeight: 1.35
      },
      subtitle1: {
        fontSize: "0.95rem",
        fontWeight: 650
      },
      body1: {
        fontSize: "0.925rem"
      },
      body2: {
        fontSize: "0.825rem",
        lineHeight: 1.5
      },
      caption: {
        fontSize: "0.74rem",
        lineHeight: 1.45
      },
      button: {
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: 0,
        textTransform: "none"
      },
      overline: {
        fontSize: "0.68rem",
        fontWeight: 750,
        lineHeight: 1.7,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
      }
    },
    components: {
      MuiCssBaseline: {
        defaultProps: {
          enableColorScheme: true
        },
        styleOverrides: {
          html: {
            backgroundColor: background,
            scrollBehavior: "smooth"
          },
          body: {
            minWidth: 320,
            backgroundColor: background,
            color: textPrimary,
            WebkitFontSmoothing: "antialiased"
          },
          "::selection": {
            backgroundColor: alpha(tokens.secondary.main, 0.28)
          },
          "*": {
            scrollbarColor: `${alpha(textSecondary, 0.35)} transparent`
          },
          "@media (prefers-reduced-motion: reduce)": {
            html: {
              scrollBehavior: "auto"
            },
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
            backgroundImage: "none"
          }
        }
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0
        },
        styleOverrides: {
          root: {
            backgroundImage: "none"
          },
          outlined: {
            borderColor: divider
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            minHeight: 36,
            borderRadius: 6,
            paddingInline: 14,
            transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
            "&:focus-visible": {
              outline: `3px solid ${alpha(tokens.primary.main, 0.26)}`,
              outlineOffset: 2
            }
          },
          containedPrimary: {
            boxShadow: `0 1px 2px ${alpha("#000000", isLight ? 0.16 : 0.32)}`,
            "&:hover": {
              boxShadow: `0 4px 14px ${alpha(tokens.primary.main, 0.26)}`
            }
          },
          outlined: {
            borderColor: divider,
            "&:hover": {
              borderColor: tokens.outlineHover
            }
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: 36,
            height: 36,
            borderRadius: 6,
            transition: "background-color 160ms ease, color 160ms ease, transform 160ms ease",
            "&:focus-visible": {
              outline: `3px solid ${alpha(tokens.primary.main, 0.26)}`,
              outlineOffset: 2
            }
          },
          sizeSmall: {
            width: 32,
            height: 32
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            height: 25,
            borderRadius: 5,
            fontSize: "0.71rem",
            fontWeight: 650
          },
          sizeSmall: {
            height: 23
          },
          label: {
            paddingInline: 8
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            backgroundColor: paper,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: divider
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: tokens.outlineHover
            }
          },
          inputSizeSmall: {
            paddingTop: 8,
            paddingBottom: 8
          }
        }
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            minWidth: 36,
            minHeight: 34,
            padding: 6,
            borderColor: divider,
            color: textSecondary,
            "&.Mui-selected": {
              color: tokens.primary.light,
              backgroundColor: alpha(tokens.primary.main, isLight ? 0.1 : 0.15)
            }
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: divider,
            paddingTop: 11,
            paddingBottom: 11
          },
          head: {
            color: textSecondary,
            fontSize: "0.7rem",
            fontWeight: 750,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            backgroundColor: tokens.tableHead
          }
        }
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 2
          }
        }
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 44,
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: "none"
          }
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${divider}`,
            boxShadow: isLight
              ? `0 24px 70px ${alpha("#111827", 0.2)}`
              : "0 24px 70px rgba(0, 0, 0, 0.55)"
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 5,
            fontSize: "0.72rem"
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
