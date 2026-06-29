import { Box, Typography } from "@mui/material";

type EmptyPanelProps = {
  label: string;
};

export function EmptyPanel({ label }: EmptyPanelProps) {
  return (
    <Box sx={{ p: 3, textAlign: "center" }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
