import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import { Box, IconButton, InputBase } from "@mui/material";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { accentGradient, glassSurface, visuallyHidden } from "./glass";

type AgentComposerProps = {
  variant: "hero" | "reply";
  busy: boolean;
  disabled?: boolean;
  onSend: (prompt: string) => void;
  onStop: () => void;
  footer?: React.ReactNode;
};

export function AgentComposer({ variant, busy, disabled = false, onSend, onStop, footer }: AgentComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = React.useState("");
  const inputId = React.useId();
  const canSend = !busy && !disabled && value.trim().length > 0;

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(value);
    setValue("");
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={(theme) => ({
        ...glassSurface(theme, "strong"),
        width: "100%",
        boxSizing: "border-box",
        borderRadius: variant === "hero" ? 3 : 2.75,
        p: variant === "hero" ? 2 : 1.5,
        pl: variant === "hero" ? 2 : 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        "&:focus-within": { borderColor: theme.palette.primary.main }
      })}
    >
      <Box component="label" htmlFor={inputId} sx={visuallyHidden}>
        {t("assistant.composerLabel")}
      </Box>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.25 }}>
        <InputBase
          id={inputId}
          multiline
          minRows={variant === "hero" ? 3 : 1}
          maxRows={10}
          value={value}
          disabled={disabled}
          autoFocus={variant === "hero"}
          placeholder={variant === "hero" ? t("assistant.placeholder") : t("assistant.replyPlaceholder")}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line; an IME composition is left alone.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          sx={{ flex: 1, minWidth: 0, fontSize: variant === "hero" ? "1.05rem" : "0.98rem", lineHeight: 1.5, px: 0.5 }}
        />
        {busy ? (
          <IconButton
            aria-label={t("assistant.stop")}
            onClick={onStop}
            sx={(theme) => ({ width: 44, height: 44, border: `1px solid ${theme.palette.divider}`, color: "text.primary" })}
          >
            <StopRoundedIcon />
          </IconButton>
        ) : (
          <IconButton
            type="submit"
            aria-label={t("assistant.send")}
            disabled={!canSend}
            sx={(theme) => ({
              width: 44,
              height: 44,
              background: accentGradient(theme),
              color: theme.palette.getContrastText(theme.palette.primary.main),
              boxShadow: canSend ? `0 6px 24px ${theme.palette.primary.main}55` : "none",
              opacity: canSend ? 1 : 0.45,
              "&.Mui-disabled": { color: theme.palette.getContrastText(theme.palette.primary.main) },
              "&:hover": { background: accentGradient(theme), filter: "brightness(1.08)" }
            })}
          >
            <ArrowUpwardRoundedIcon />
          </IconButton>
        )}
      </Box>
      {footer}
    </Box>
  );
}
