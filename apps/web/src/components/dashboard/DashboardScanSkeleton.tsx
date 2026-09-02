import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from "@mui/material";
import React from "react";
import { useTranslation } from "react-i18next";

const CARD_SKELETON_COUNT = 10;
const TABLE_SKELETON_ROW_COUNT = 8;
const TABLE_SKELETON_COLUMN_COUNT = 6;

export function RepositoryGridSkeleton() {
  const { t } = useTranslation();

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={t("navigation.scanningWorkspace")}
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))",
          lg: "repeat(4, minmax(0, 1fr))",
          xl: "repeat(5, minmax(0, 1fr))"
        },
        gap: 1.25
      }}
    >
      {Array.from({ length: CARD_SKELETON_COUNT }, (_, index) => (
        <ProjectCardSkeleton key={index} />
      ))}
    </Box>
  );
}

function ProjectCardSkeleton() {
  return (
    <Paper
      sx={{
        minHeight: 154,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper"
      }}
    >
      <Stack spacing={1.1} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Skeleton variant="rounded" width={34} height={34} animation="wave" />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Skeleton variant="text" animation="wave" sx={{ fontSize: "0.95rem", width: "70%" }} />
            <Skeleton variant="text" animation="wave" sx={{ fontSize: "0.8rem", width: "45%" }} />
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.6}>
          <Skeleton variant="rounded" width={70} height={20} animation="wave" />
          <Skeleton variant="rounded" width={52} height={20} animation="wave" />
        </Stack>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ pt: 0.9, borderTop: "1px solid", borderColor: "divider" }}>
          <Skeleton variant="text" animation="wave" sx={{ fontSize: "0.8rem", width: "85%" }} />
          <Skeleton variant="text" animation="wave" sx={{ fontSize: "0.75rem", width: "55%" }} />
        </Box>
      </Stack>
    </Paper>
  );
}

export function RepositoryTableSkeleton() {
  const { t } = useTranslation();

  return (
    <Box
      role="status"
      aria-live="polite"
      aria-label={t("navigation.scanningWorkspace")}
      sx={{
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "background.paper"
      }}
    >
      <TableContainer>
        <Table size="small" sx={{ minWidth: 1040 }}>
          <TableHead>
            <TableRow>
              {Array.from({ length: TABLE_SKELETON_COLUMN_COUNT }, (_, index) => (
                <TableCell key={index}>
                  <Skeleton variant="text" animation="wave" width="55%" />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: TABLE_SKELETON_ROW_COUNT }, (_, rowIndex) => (
              <TableRow key={rowIndex}>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Skeleton variant="rounded" width={32} height={32} animation="wave" />
                    <Skeleton variant="text" animation="wave" width={120} />
                  </Stack>
                </TableCell>
                <TableCell><Skeleton variant="text" animation="wave" width={80} /></TableCell>
                <TableCell><Skeleton variant="rounded" animation="wave" width={72} height={20} /></TableCell>
                <TableCell><Skeleton variant="rounded" animation="wave" width={72} height={20} /></TableCell>
                <TableCell><Skeleton variant="text" animation="wave" width={170} /></TableCell>
                <TableCell><Skeleton variant="text" animation="wave" width={150} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// Mirrors the default widget arrangement so the page does not jump when the data lands:
// a two-wide panel and two singles, then two rows of halves.
const HOME_SKELETON_TILES: Array<{ columns: 1 | 2; rows: number }> = [
  { columns: 2, rows: 4 },
  { columns: 1, rows: 3 },
  { columns: 1, rows: 2 },
  { columns: 2, rows: 4 },
  { columns: 2, rows: 4 },
  { columns: 2, rows: 2 },
  { columns: 2, rows: 3 }
];

export function DashboardHomeSkeleton() {
  const { t } = useTranslation();

  return (
    <Stack
      spacing={2}
      role="status"
      aria-live="polite"
      aria-label={t("navigation.scanningWorkspace")}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 1.5,
          pb: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Box sx={{ minWidth: 0, flex: "1 1 320px" }}>
          <Skeleton variant="text" animation="wave" sx={{ fontSize: "1.9rem", width: "48%" }} />
          <Skeleton variant="text" animation="wave" sx={{ width: "36%", maxWidth: 360, mt: 0.6 }} />
        </Box>
        <Skeleton variant="rounded" animation="wave" width={110} height={32} />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(4, minmax(0, 1fr))"
          },
          gridAutoRows: { xs: "auto", md: "236px" }
        }}
      >
        {HOME_SKELETON_TILES.map((tile, index) => (
          <Box
            key={index}
            sx={{
              gridColumn: { xs: "span 1", md: `span ${tile.columns}` },
              minHeight: { xs: 148, md: 0 },
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "var(--rc-radius-panel)",
              bgcolor: "background.paper"
            }}
          >
            <Box sx={{ minHeight: 38, px: 1.5, display: "flex", alignItems: "center", borderBottom: "1px solid", borderColor: "divider" }}>
              <Skeleton variant="text" animation="wave" width={110} />
            </Box>
            {Array.from({ length: tile.rows }, (_, rowIndex) => (
              <Stack
                key={rowIndex}
                direction="row"
                spacing={1.1}
                alignItems="center"
                sx={{ minHeight: 44, px: 1.5, borderBottom: "1px solid", borderColor: "divider", "&:last-child": { borderBottom: 0 } }}
              >
                <Skeleton variant="circular" width={12} height={12} animation="wave" />
                <Box sx={{ flexGrow: 1 }}>
                  <Skeleton variant="text" animation="wave" width={`${44 + ((rowIndex * 19) % 34)}%`} />
                  <Skeleton variant="text" animation="wave" width="30%" sx={{ fontSize: "0.7rem" }} />
                </Box>
                <Skeleton variant="text" animation="wave" width={34} />
              </Stack>
            ))}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
