import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, CircularProgress, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { MONO_FONT_FAMILY } from "../../theme";
import { describeToolInput, summarizeToolResult, type ToolActivity } from "./turnView";

export function ToolActivityGroup({ tools, running }: { tools: ToolActivity[]; running: boolean }) {
  const { t } = useTranslation();
  const working = running && tools.some((tool) => tool.result === null);

  return (
    <Box
      component="details"
      open={working || undefined}
      sx={(theme) => ({
        borderRadius: 2,
        bgcolor: alpha(theme.palette.text.primary, 0.035),
        border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        "& > summary": { cursor: "pointer", listStyle: "revert", px: 1.75, py: 1, fontSize: "0.82rem", color: "text.secondary" }
      })}
    >
      <summary>
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
          {working ? <CircularProgress size={11} thickness={6} aria-hidden /> : null}
          {working ? t("assistant.activity.running", { count: tools.length }) : t("assistant.activity.done", { count: tools.length })}
        </Box>
      </summary>
      <Box component="ol" sx={{ listStyle: "none", m: 0, px: 1.75, pb: 1.25, display: "flex", flexDirection: "column", gap: 0.75 }}>
        {tools.map((tool) => (
          <Box key={tool.toolUseId} component="li" sx={{ display: "flex", alignItems: "center", gap: 1, fontSize: "0.8rem", minWidth: 0 }}>
            {tool.result === null ? (
              <CircularProgress size={12} thickness={6} aria-label={t("assistant.activity.pending")} />
            ) : tool.result.isError ? (
              <CloseRoundedIcon sx={{ fontSize: 15, color: "error.main" }} aria-label={t("assistant.activity.failed")} />
            ) : (
              <CheckRoundedIcon sx={{ fontSize: 15, color: "success.main" }} aria-hidden />
            )}
            <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY, color: "text.primary", flex: "none" }}>{tool.name}</Box>
            <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY, color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
              {describeToolInput(tool.input)}
            </Box>
            {tool.result ? (
              <Typography component="span" sx={{ ml: "auto", pl: 1, fontSize: "0.78rem", color: tool.result.isError ? "error.main" : "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "45%" }}>
                {summarizeToolResult(tool.result.text)}
              </Typography>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
