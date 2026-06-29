import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { Box, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";

type WorkspacePickerBarProps = {
  root: string;
  error: string | null;
  isPicking: boolean;
  onPick: () => void;
};

export function WorkspacePickerBar({ root, error, isPicking, onPick }: WorkspacePickerBarProps) {
  return (
    <Box sx={{ display: "grid", justifyItems: "center" }}>
      <Paper
        component="button"
        type="button"
        variant="outlined"
        onClick={onPick}
        disabled={isPicking}
        aria-label="Choose workspace folder"
        sx={{
          width: "min(100%, 920px)",
          p: { xs: 1.5, sm: 2 },
          font: "inherit",
          color: "text.primary",
          textAlign: "left",
          bgcolor: "background.paper",
          borderColor: error ? "error.main" : "divider",
          cursor: isPicking ? "default" : "pointer",
          transition: "border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease",
          "&:hover": {
            borderColor: error ? "error.main" : "primary.main",
            boxShadow: 3,
            transform: isPicking ? "none" : "translateY(-1px)"
          },
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2
          }
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%", minWidth: 0 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              display: "grid",
              placeItems: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              flexShrink: 0
            }}
          >
            {isPicking ? <CircularProgress size={19} /> : <FolderOpenIcon fontSize="small" />}
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="caption" color="text.secondary" component="div">
              Workspace folder
            </Typography>
            <Typography
              variant="body1"
              component="div"
              noWrap
              sx={{ fontFamily: "monospace", fontWeight: 700, lineHeight: 1.35 }}
            >
              {root || "Seleziona una cartella"}
            </Typography>
          </Box>

          <Chip size="small" label={isPicking ? "Apertura" : "Cambia"} color={error ? "error" : "primary"} />
        </Stack>
      </Paper>

      {error ? (
        <Typography color="error" variant="caption" sx={{ width: "min(100%, 920px)", mt: 0.75 }}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
