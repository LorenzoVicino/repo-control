import { Box, Typography } from "@mui/material";

type EmptyPanelProps = {
  label: string;
};

export function EmptyPanel({ label }: EmptyPanelProps) {
  return (
    <Box
      sx={{
        minHeight: 180,
        display: "grid",
        placeItems: "center",
        p: 3,
        textAlign: "center",
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
