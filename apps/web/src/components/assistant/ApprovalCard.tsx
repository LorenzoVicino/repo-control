import GppMaybeOutlinedIcon from "@mui/icons-material/GppMaybeOutlined";
import { Box, Button, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { MONO_FONT_FAMILY } from "../../theme";
import type { ApprovalState } from "./turnView";

type ApprovalCardProps = {
  title: string;
  toolName: string;
  input: Record<string, unknown>;
  state: ApprovalState;
  onDecide: (behavior: "allow" | "deny") => Promise<void>;
};

export function ApprovalCard({ title, toolName, input, state, onDecide }: ApprovalCardProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = React.useState<"allow" | "deny" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const pending = state === "pending";
  const headingId = React.useId();

  async function decide(behavior: "allow" | "deny") {
    setSubmitting(behavior);
    setError(null);
    try {
      await onDecide(behavior);
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : t("assistant.errors.decisionFailed"));
    } finally {
      setSubmitting(null);
    }
  }

  const outcome = {
    pending: null,
    allowed: t("assistant.approval.allowed"),
    denied: t("assistant.approval.denied"),
    expired: t("assistant.approval.expired"),
    cancelled: t("assistant.approval.cancelled")
  }[state];

  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={(theme) => ({
        p: 2,
        borderRadius: 2.5,
        bgcolor: alpha(theme.palette.primary.main, pending ? 0.12 : 0.05),
        border: `1px solid ${alpha(theme.palette.primary.main, pending ? 0.45 : 0.18)}`,
        boxShadow: pending ? `0 0 40px ${alpha(theme.palette.primary.main, 0.16)}` : "none",
        backdropFilter: "blur(20px)",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        transition: "background-color 200ms, border-color 200ms, box-shadow 200ms"
      })}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <GppMaybeOutlinedIcon fontSize="small" sx={{ color: "primary.light" }} aria-hidden />
        <Typography id={headingId} component="h3" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
          {pending ? t("assistant.approval.ask") : outcome}
        </Typography>
        <Typography sx={{ ml: "auto !important", fontSize: "0.8rem", color: "text.secondary" }}>{pending ? t("assistant.approval.note") : null}</Typography>
      </Stack>

      <Box sx={(theme) => ({ p: 1.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.background.default, 0.5), border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}` })}>
        <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", mb: 0.5 }}>
          {title} <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY, fontWeight: 400, fontSize: "0.78rem", color: "text.secondary" }}>{toolName}</Box>
        </Typography>
        <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "max-content 1fr", columnGap: 1.5, rowGap: 0.25, fontSize: "0.82rem" }}>
          {Object.entries(input).map(([key, value]) => (
            <React.Fragment key={key}>
              <Box component="dt" sx={{ color: "text.secondary" }}>{key}</Box>
              <Box component="dd" sx={{ m: 0, fontFamily: MONO_FONT_FAMILY, wordBreak: "break-word" }}>
                {typeof value === "string" ? value : JSON.stringify(value)}
              </Box>
            </React.Fragment>
          ))}
        </Box>
      </Box>

      {pending ? (
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            disableElevation
            disabled={submitting !== null}
            onClick={() => void decide("allow")}
            sx={(theme) => ({ borderRadius: 999, px: 2.5, background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.info.main})`, color: theme.palette.getContrastText(theme.palette.primary.main), fontWeight: 600 })}
          >
            {t("assistant.approval.approve")}
          </Button>
          <Button variant="outlined" color="inherit" disabled={submitting !== null} onClick={() => void decide("deny")} sx={{ borderRadius: 999, px: 2.25 }}>
            {t("assistant.approval.deny")}
          </Button>
        </Stack>
      ) : null}
      {error ? (
        <Typography role="alert" sx={{ fontSize: "0.82rem", color: "error.main" }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
