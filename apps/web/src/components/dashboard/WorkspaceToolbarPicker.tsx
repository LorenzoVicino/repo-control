import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

type WorkspaceToolbarPickerProps = {
  root: string;
  error: string | null;
  isPicking: boolean;
  isScanning?: boolean;
  onPick: () => void;
};

export function WorkspaceToolbarPicker({
  root,
  error,
  isPicking,
  isScanning = false,
  onPick
}: WorkspaceToolbarPickerProps) {
  const { t } = useTranslation();
  const displayPath = root || t("navigation.selectWorkspace");
  const isBusy = isPicking || isScanning;
  const statusText = isPicking
    ? t("navigation.openingFolderPicker")
    : isScanning
      ? t("navigation.scanningWorkspace")
      : displayPath;
  const accessibleLabel = isBusy ? statusText : t("navigation.changeWorkspace");

  return (
    <Tooltip title={error ?? (isBusy ? statusText : `${displayPath} · Ctrl+O`)} disableInteractive>
      <Stack
        aria-busy={isBusy}
        aria-live="polite"
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{
          minWidth: 0,
          width: "100%",
          justifySelf: "stretch",
          px: 1,
          minHeight: 38,
          border: "1px solid",
          borderColor: error ? "error.main" : isScanning ? "primary.main" : "divider",
          borderRadius: 0.875,
          bgcolor: "background.paper",
          transition: "border-color 160ms ease",
          "&:hover": { borderColor: error ? "error.main" : "primary.light" }
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            minWidth: 0,
            flexGrow: 1,
            fontFamily: "monospace",
            color: error ? "error.main" : "text.secondary"
          }}
        >
          {statusText}
        </Typography>

        <Typography
          component="kbd"
          variant="caption"
          color="text.secondary"
          sx={{
            display: isBusy ? "none" : { xs: "none", lg: "inline" },
            px: 0.65,
            py: 0.15,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 0.5,
            bgcolor: "action.hover",
            fontFamily: "inherit",
            fontSize: "0.65rem",
            whiteSpace: "nowrap"
          }}
        >
          Ctrl+O
        </Typography>

        <IconButton
          size="small"
          color={error ? "error" : "primary"}
          onClick={onPick}
          disabled={isBusy}
          aria-label={accessibleLabel}
          sx={{ width: 28, height: 28, flexShrink: 0 }}
        >
          {isBusy ? <CircularProgress color="inherit" size={15} /> : <FolderOpenIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Tooltip>
  );
}
