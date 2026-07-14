import { alpha, createTheme } from "@mui/material";
import type { ColorMode } from "./types/common";

export const COLOR_MODE_STORAGE_KEY = "repo-control-color-mode";

const brand = {
  blue: "#2563eb",
  blueDark: "#1d4ed8",
  cyan: "#0ea5e9",
  navy: "#0b1730"
};

export function createAppTheme(colorMode: ColorMode) {
  const isLight = colorMode === "light";
  const background = isLight ? "#f5f8fc" : "#07101f";
  const paper = isLight ? "#ffffff" : "#0d192b";
  const divider = isLight ? "#dfe7f1" : "#20324a";
  const textPrimary = isLight ? "#13213a" : "#eaf2ff";
  const textSecondary = isLight ? "#607089" : "#94a8c4";

  return createTheme({
    palette: {
      mode: colorMode,
      primary: {
        main: isLight ? brand.blue : "#60a5fa",
        dark: isLight ? brand.blueDark : "#3b82f6",
        light: isLight ? "#60a5fa" : "#93c5fd",
        contrastText: "#ffffff"
      },
      secondary: {
        main: isLight ? brand.cyan : "#38bdf8",
        dark: isLight ? "#0284c7" : "#0ea5e9",
        contrastText: "#ffffff"
      },
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
        hover: alpha(isLight ? brand.blue : "#93c5fd", isLight ? 0.055 : 0.09),
        selected: alpha(isLight ? brand.blue : "#60a5fa", isLight ? 0.1 : 0.16),
        focus: alpha(isLight ? brand.blue : "#60a5fa", 0.16),
        disabledBackground: isLight ? "#e9eef5" : "#17243a"
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
            backgroundColor: alpha(brand.cyan, 0.24)
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
              outline: `3px solid ${alpha(isLight ? brand.blue : "#60a5fa", 0.24)}`,
              outlineOffset: 2
            }
          },
          containedPrimary: {
            boxShadow: `0 1px 2px ${alpha(brand.navy, 0.16)}`,
            "&:hover": {
              boxShadow: `0 4px 12px ${alpha(brand.blue, 0.22)}`
            }
          },
          outlined: {
            borderColor: divider,
            "&:hover": {
              borderColor: isLight ? "#b8c7da" : "#38516f"
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
              outline: `3px solid ${alpha(isLight ? brand.blue : "#60a5fa", 0.24)}`,
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
              borderColor: isLight ? "#b8c7da" : "#38516f"
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
              color: isLight ? brand.blue : "#93c5fd",
              backgroundColor: alpha(isLight ? brand.blue : "#60a5fa", isLight ? 0.1 : 0.15)
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
            backgroundColor: isLight ? "#f7f9fc" : "#101f34"
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
              ? `0 24px 70px ${alpha(brand.navy, 0.2)}`
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

export function getInitialColorMode(): ColorMode {
  const storedMode = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY);

  if (storedMode === "light" || storedMode === "dark") {
    return storedMode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
