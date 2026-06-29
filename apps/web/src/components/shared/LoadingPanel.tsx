import { Box, CircularProgress, Stack, Typography } from "@mui/material";

type LoadingPanelProps = {
  label: string;
};

export function LoadingPanel({ label }: LoadingPanelProps) {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: 220 }}>
      <Stack spacing={1} alignItems="center">
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Stack>
    </Box>
  );
}
