import { Box, Stack, Typography } from "@mui/material";
import React from "react";

type DetailBlockProps = {
  title: string;
  children: React.ReactNode;
};

export function DetailBlock({ title, children }: DetailBlockProps) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
        {title}
      </Typography>
      <Stack spacing={1}>{children}</Stack>
    </Box>
  );
}
