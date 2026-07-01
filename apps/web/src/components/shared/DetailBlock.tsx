import { Box, Stack, Typography } from "@mui/material";
import React from "react";

type DetailBlockProps = {
  title: string;
  children: React.ReactNode;
};

export function DetailBlock({ title, children }: DetailBlockProps) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0 }}>
        {title}
      </Typography>
      <Stack
        spacing={1}
        sx={{
          p: 1.25,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 0.5,
          bgcolor: "background.paper"
        }}
      >
        {children}
      </Stack>
    </Box>
  );
}
