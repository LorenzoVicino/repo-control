import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Box, Button, CircularProgress, Stack, Tooltip, Typography } from "@mui/material";

type WorkspaceToolbarPickerProps = {
  root: string;
  error: string | null;
  isPicking: boolean;
  onPick: () => void;
};

export function WorkspaceToolbarPicker({ root, error, isPicking, onPick }: WorkspaceToolbarPickerProps) {
  const displayPath = root || "Seleziona workspace";

  return (
    <Tooltip title={error ?? displayPath}>
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{
          minWidth: 0,
          width: "100%",
          justifySelf: "stretch",
          px: 1,
          py: 0.5,
          minHeight: 36,
          border: "1px solid",
          borderColor: error ? "error.main" : "divider",
          borderRadius: 1,
          bgcolor: "background.paper"
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

        <Button
          size="small"
          variant="text"
          color={error ? "error" : "primary"}
          onClick={onPick}
          disabled={isPicking}
          aria-label="Cambia workspace folder"
          startIcon={isPicking ? <CircularProgress color="inherit" size={14} /> : <FolderOpenIcon fontSize="small" />}
          sx={{
            minWidth: 72,
            px: 0.75,
            py: 0.25,
            fontSize: "0.75rem",
            "& .MuiButton-startIcon": {
              ml: 0,
              mr: 0.5
            }
          }}
        >
          <Box component="span">Cambia</Box>
        </Button>
      </Stack>
    </Tooltip>
  );
}
