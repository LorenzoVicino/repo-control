import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import FormatSizeRoundedIcon from "@mui/icons-material/FormatSizeRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import {
  alpha,
  Box,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography
} from "@mui/material";
import type { ReactElement, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  changeAppLanguage,
  getCurrentLanguage,
  isAppLanguage,
  type AppLanguage
} from "../../i18n";
import { COLOR_PALETTE_OPTIONS, COLOR_SWATCH_RING, FONT_SCALE_OPTIONS } from "../../theme";
import type { ColorPalette, FontScale } from "../../types/common";

const LANGUAGE_OPTIONS: ReadonlyArray<{
  code: AppLanguage;
  labelKey: "settings.english" | "settings.italian";
  nativeLabelKey: "settings.englishNative" | "settings.italianNative";
}> = [
  { code: "en", labelKey: "settings.english", nativeLabelKey: "settings.englishNative" },
  { code: "it", labelKey: "settings.italian", nativeLabelKey: "settings.italianNative" }
];

function isColorPalette(value: string): value is ColorPalette {
  return COLOR_PALETTE_OPTIONS.some((option) => option.id === value);
}

function isFontScale(value: string): value is FontScale {
  return FONT_SCALE_OPTIONS.some((option) => option.id === value);
}

type SettingsPageProps = {
  colorPalette: ColorPalette;
  fontScale: FontScale;
  onColorPaletteChange: (colorPalette: ColorPalette) => void;
  onFontScaleChange: (fontScale: FontScale) => void;
};

export function SettingsPage({
  colorPalette,
  fontScale,
  onColorPaletteChange,
  onFontScaleChange
}: SettingsPageProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = isAppLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : getCurrentLanguage();

  return (
    <Box component="section" aria-labelledby="settings-title" sx={{ maxWidth: 1120, mx: "auto" }}>
      <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            border: "1px solid",
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
            borderRadius: 1.5,
            color: "primary.main",
            bgcolor: "var(--rc-accent-tint)",
            boxShadow: (theme) => `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.08)}`
          }}
        >
          <SettingsRoundedIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" color="primary.main" sx={{ display: "block", mb: 0.25 }}>
            {t("settings.eyebrow")}
          </Typography>
          <Typography id="settings-title" component="h1" variant="h1">
            {t("settings.title")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.8, maxWidth: 680, fontSize: 12.5, lineHeight: 1.6 }}>
            {t("settings.description")}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
          gap: { xs: 1.5, md: 2 }
        }}
      >
        <Paper
          component="nav"
          aria-label={t("settings.title")}
          variant="outlined"
          sx={{ alignSelf: "start", p: 0.75, bgcolor: "background.paper" }}
        >
          <Stack
            direction="row"
            spacing={1.1}
            alignItems="center"
            aria-current="page"
            sx={{
              minHeight: 48,
              px: 1.25,
              borderRadius: 0.875,
              color: "text.primary",
              bgcolor: "var(--rc-surface-3)",
              boxShadow: (theme) => `inset 2px 0 0 ${theme.palette.primary.main}`
            }}
          >
            <TuneRoundedIcon color="primary" sx={{ fontSize: 19 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t("settings.general")}
              </Typography>
              <Typography color="text.secondary" noWrap sx={{ mt: 0.1, fontSize: 9.5 }}>
                {t("settings.generalDescription")}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Stack spacing={{ xs: 1.5, md: 2 }}>
          <PreferenceCard icon={<LanguageRoundedIcon />} title={t("settings.languageAndRegion")}>
            <PreferenceChoice
              labelId="interface-language-label"
              title={t("settings.languageTitle")}
              description={t("settings.languageDescription")}
              fieldLabel={t("settings.languageFieldLabel")}
              value={currentLanguage}
              columns={{ xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }}
              onChange={(value) => {
                if (isAppLanguage(value)) void changeAppLanguage(value);
              }}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <PreferenceOption
                  key={option.code}
                  value={option.code}
                  isActive={option.code === currentLanguage}
                  title={t(option.labelKey)}
                  description={t(option.nativeLabelKey)}
                  activeLabel={t("settings.active")}
                  leading={
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 34,
                        height: 34,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        borderRadius: 1,
                        bgcolor: option.code === currentLanguage ? "primary.main" : "var(--rc-surface-3)",
                        color: option.code === currentLanguage ? "primary.contrastText" : "text.secondary",
                        fontFamily: "var(--rc-font-mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.04em"
                      }}
                    >
                      {option.code.toUpperCase()}
                    </Box>
                  }
                />
              ))}
            </PreferenceChoice>
          </PreferenceCard>

          <PreferenceCard icon={<PaletteOutlinedIcon />} title={t("settings.appearance")}>
            <PreferenceChoice
              labelId="interface-palette-label"
              title={t("settings.paletteTitle")}
              description={t("settings.paletteDescription")}
              fieldLabel={t("settings.paletteFieldLabel")}
              value={colorPalette}
              columns={{
                xs: "minmax(0, 1fr)",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))"
              }}
              onChange={(value) => {
                if (isColorPalette(value)) onColorPaletteChange(value);
              }}
            >
              {COLOR_PALETTE_OPTIONS.map((option) => (
                <PreferenceOption
                  key={option.id}
                  value={option.id}
                  isActive={option.id === colorPalette}
                  title={t(`appearance.palettes.${option.id}.label`)}
                  description={t(`appearance.palettes.${option.id}.description`)}
                  activeLabel={t("settings.active")}
                  leading={
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 34,
                        height: 34,
                        flexShrink: 0,
                        border: "1px solid",
                        borderColor: COLOR_SWATCH_RING,
                        borderRadius: "50%",
                        bgcolor: option.swatch
                      }}
                    />
                  }
                />
              ))}
            </PreferenceChoice>
          </PreferenceCard>

          <PreferenceCard icon={<FormatSizeRoundedIcon />} title={t("settings.textSize")}>
            <PreferenceChoice
              labelId="interface-font-scale-label"
              title={t("settings.fontSizeTitle")}
              description={t("settings.fontSizeDescription")}
              fieldLabel={t("settings.fontSizeFieldLabel")}
              value={fontScale}
              columns={{ xs: "minmax(0, 1fr)", sm: "repeat(3, minmax(0, 1fr))" }}
              onChange={(value) => {
                if (isFontScale(value)) onFontScaleChange(value);
              }}
            >
              {FONT_SCALE_OPTIONS.map((option) => (
                <PreferenceOption
                  key={option.id}
                  value={option.id}
                  isActive={option.id === fontScale}
                  title={t(`appearance.fontScales.${option.id}.label`)}
                  description={t(`appearance.fontScales.${option.id}.description`)}
                  activeLabel={t("settings.active")}
                  leading={
                    <Box
                      aria-hidden="true"
                      sx={{
                        width: 34,
                        height: 34,
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        borderRadius: 1,
                        bgcolor: option.id === fontScale ? "primary.main" : "var(--rc-surface-3)",
                        color: option.id === fontScale ? "primary.contrastText" : "text.secondary",
                        fontWeight: 600,
                        // Written as a CSS string so it survives the theme's own font-size
                        // scaling: each sample must show its own size, not the active one.
                        fontSize: `${Math.round(13 * option.multiplier * 10) / 10}px`
                      }}
                    >
                      Aa
                    </Box>
                  }
                />
              ))}
            </PreferenceChoice>
          </PreferenceCard>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 1, sm: 1.5 }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            sx={{ p: 1.5, borderRadius: 1, bgcolor: "var(--rc-surface-2)" }}
          >
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <CheckRoundedIcon color="success" sx={{ mt: 0.1, fontSize: 18 }} />
              <Box>
                <Typography aria-live="polite" variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                  {t("settings.savedAutomatically")}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.25, maxWidth: 570, fontSize: 10.5, lineHeight: 1.5 }}>
                  {t("settings.immediateNote")}
                </Typography>
              </Box>
            </Stack>
            <Typography
              color="text.disabled"
              noWrap
              sx={{ pl: { xs: 3.25, sm: 0 }, fontFamily: "var(--rc-font-mono)", fontSize: 9 }}
            >
              {t("settings.translationEngine")}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

function PreferenceCard({
  icon,
  title,
  children
}: {
  icon: ReactElement;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", bgcolor: "background.paper" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: { xs: 2, sm: 2.5 }, py: 1.75 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ display: "flex", color: "primary.main", "& svg": { fontSize: 19 } }}>{icon}</Box>
          <Typography component="h2" variant="h3">
            {title}
          </Typography>
        </Stack>
        <Chip
          size="small"
          variant="outlined"
          label={t("settings.localPreference")}
          sx={{ display: { xs: "none", sm: "inline-flex" }, color: "text.secondary" }}
        />
      </Stack>

      <Divider />

      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>{children}</Box>
    </Paper>
  );
}

function PreferenceChoice({
  labelId,
  title,
  description,
  fieldLabel,
  value,
  columns,
  onChange,
  children
}: {
  labelId: string;
  title: string;
  description: string;
  fieldLabel: string;
  value: string;
  columns: Record<string, string>;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <FormControl fullWidth>
      <FormLabel
        id={labelId}
        sx={{ color: "text.primary", fontSize: 14, fontWeight: 600, "&.Mui-focused": { color: "text.primary" } }}
      >
        {title}
      </FormLabel>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 620, fontSize: 12, lineHeight: 1.55 }}>
        {description}
      </Typography>

      <RadioGroup
        row
        aria-labelledby={labelId}
        aria-label={fieldLabel}
        value={value}
        onChange={(_, nextValue) => onChange(nextValue)}
        sx={{ display: "grid", gridTemplateColumns: columns, gap: 1.25 }}
      >
        {children}
      </RadioGroup>
    </FormControl>
  );
}

function PreferenceOption({
  value,
  isActive,
  leading,
  title,
  description,
  activeLabel
}: {
  value: string;
  isActive: boolean;
  leading: ReactNode;
  title: string;
  description: string;
  activeLabel: string;
}) {
  return (
    <FormControlLabel
      value={value}
      control={<Radio size="small" sx={{ alignSelf: "flex-start", mt: 0.25 }} />}
      label={
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flexGrow: 1 }}>
          {leading}
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.15, fontSize: 10.5 }}>
              {description}
            </Typography>
          </Box>
          {isActive ? (
            <Chip
              size="small"
              color="primary"
              icon={<CheckRoundedIcon />}
              label={activeLabel}
              sx={{ display: { xs: "none", xl: "inline-flex" }, mr: 0.25 }}
            />
          ) : null}
        </Stack>
      }
      sx={{
        m: 0,
        minWidth: 0,
        minHeight: 72,
        px: 1.25,
        py: 1,
        alignItems: "center",
        border: "1px solid",
        borderColor: isActive ? "primary.main" : "divider",
        borderRadius: 1.25,
        bgcolor: isActive ? "var(--rc-accent-tint)" : "var(--rc-surface-1)",
        transition: "border-color var(--rc-motion-fast) ease, background-color var(--rc-motion-fast) ease",
        "&:hover": { borderColor: isActive ? "primary.main" : "var(--rc-border-strong)" },
        "&:focus-within": {
          outline: (theme) => `3px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          outlineOffset: 1
        },
        "& .MuiFormControlLabel-label": { minWidth: 0, flexGrow: 1 }
      }}
    />
  );
}
