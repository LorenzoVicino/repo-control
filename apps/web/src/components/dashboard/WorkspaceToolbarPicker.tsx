import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";

type WorkspaceToolbarPickerProps = {
  root: string;
  error: string | null;
  isPicking: boolean;
  onPick: () => void;
};

export function WorkspaceToolbarPicker({ root, error, isPicking, onPick }: WorkspaceToolbarPickerProps) {
  const displayPath = root || "Seleziona workspace";

  return (
    <Tooltip title={error ?? `${displayPath} · Ctrl+O`} disableInteractive>
      <Stack
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
          borderColor: error ? "error.main" : "divider",
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
          {displayPath}
        </Typography>

        <Typography
          component="kbd"
          variant="caption"
          color="text.secondary"
          sx={{
            display: { xs: "none", lg: "inline" },
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
          disabled={isPicking}
          aria-label="Cambia workspace folder, scorciatoia Ctrl+O"
          sx={{ width: 28, height: 28, flexShrink: 0 }}
        >
          {isPicking ? <CircularProgress color="inherit" size={15} /> : <FolderOpenIcon fontSize="small" />}
        </IconButton>
      </Stack>
    </Tooltip>
  );
}
