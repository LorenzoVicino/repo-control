import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, CircularProgress } from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";
import { WidgetBody, WidgetHeader, WidgetRow, type DashboardWidgetProps } from "../DashboardWidgetPrimitives";

// Only what is reached many times a day and has no other visible entry point except a
// key combination. Section pages already sit in the sidebar and are not repeated here.
export function ShortcutsWidget({ titleId, context }: DashboardWidgetProps) {
  const { t } = useTranslation();
  const modifier = React.useMemo(() => (/mac/i.test(window.navigator.platform) ? "⌘" : "Ctrl"), []);

  return (
    <>
      <WidgetHeader titleId={titleId} title={t("dashboard.widgets.shortcuts.title")} />
      <WidgetBody>
        <WidgetRow
          minHeight={52}
          onClick={context.onOpenSearch}
          leading={<SearchRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />}
          primary={t("dashboard.widgets.shortcuts.search")}
          trailing={<Keys keys={[modifier, "P"]} />}
        />
        <WidgetRow
          minHeight={52}
          onClick={context.onPickWorkspace}
          leading={<FolderOpenOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />}
          primary={t("dashboard.widgets.shortcuts.workspace")}
          trailing={<Keys keys={[modifier, "O"]} />}
        />
        <WidgetRow
          minHeight={52}
          onClick={context.onRefreshWorkspace}
          leading={context.isRefreshing
            ? <CircularProgress size={14} thickness={5} aria-hidden="true" />
            : <RefreshRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />}
          primary={context.isRefreshing ? t("dashboard.widgets.shortcuts.rescanning") : t("dashboard.widgets.shortcuts.rescan")}
        />
      </WidgetBody>
    </>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <Box component="span" aria-label={keys.join(" + ")} sx={{ display: "inline-flex", gap: 0.4 }}>
      {keys.map((key) => (
        <Box
          key={key}
          component="kbd"
          sx={{
            fontFamily: "var(--rc-font-mono)",
            fontSize: 9.5,
            lineHeight: 1,
            px: 0.6,
            py: 0.4,
            border: "1px solid",
            borderColor: "var(--rc-border-strong)",
            borderRadius: "4px",
            color: "text.secondary",
            bgcolor: "var(--rc-surface-2)"
          }}
        >
          {key}
        </Box>
      ))}
    </Box>
  );
}
