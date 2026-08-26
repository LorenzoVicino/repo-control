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
const HOME_LEDGER_ROW_COUNT = 6;

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

export function DashboardHomeSkeleton() {
  const { t } = useTranslation();

  return (
    <Stack
      spacing={2.25}
      role="status"
      aria-live="polite"
      aria-label={t("navigation.scanningWorkspace")}
      sx={{ minHeight: { md: "calc(100dvh - 102px)" } }}
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
          gap: 2,
          alignItems: "end",
          pb: 1.75,
          borderBottom: "1px solid",
          borderColor: "divider"
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Skeleton variant="text" animation="wave" width={90} />
          <Skeleton variant="text" animation="wave" sx={{ fontSize: "1.9rem", width: "60%", mt: 0.35 }} />
          <Skeleton variant="text" animation="wave" sx={{ width: "80%", maxWidth: 480, mt: 0.7 }} />
        </Box>
        <Stack direction="row" spacing={{ xs: 2, sm: 3.5 }}>
          {Array.from({ length: 3 }, (_, index) => (
            <Box key={index} sx={{ minWidth: 62 }}>
              <Skeleton variant="text" animation="wave" sx={{ fontSize: 20, width: 34 }} />
              <Skeleton variant="text" animation="wave" width={54} />
            </Box>
          ))}
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(280px, 0.72fr) minmax(420px, 1.28fr)" },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "var(--rc-radius-panel)",
          overflow: "hidden"
        }}
      >
        <Box
          sx={{
            p: { xs: 1.5, sm: 1.75 },
            borderRight: { lg: "1px solid" },
            borderBottom: { xs: "1px solid", lg: 0 },
            borderColor: "divider"
          }}
        >
          <Skeleton variant="text" animation="wave" width={80} />
          <Skeleton variant="text" animation="wave" sx={{ fontSize: "1.1rem", width: "50%", mt: 0.2 }} />
          <Skeleton variant="rounded" animation="wave" height={11} sx={{ mt: 2, borderRadius: 999 }} />
          <Stack direction="row" spacing={1.5} sx={{ mt: 1.6 }}>
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} variant="text" animation="wave" width={90} />
            ))}
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 1.5, sm: 1.75 } }}>
          <Skeleton variant="text" animation="wave" width={200} />
          <Stack spacing={0.9} sx={{ mt: 1.4 }}>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} variant="rounded" animation="wave" height={8} sx={{ borderRadius: 999 }} />
            ))}
          </Stack>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            lg: "minmax(0, 1fr) 340px",
            xl: "minmax(0, 1fr) 376px"
          },
          gap: 1.5,
          alignItems: "start"
        }}
      >
        <WorkbenchSkeletonPanel>
          {Array.from({ length: HOME_LEDGER_ROW_COUNT }, (_, index) => (
            <Stack
              key={index}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{
                minHeight: 44,
                px: 1.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-child": { borderBottom: 0 }
              }}
            >
              <Skeleton variant="text" animation="wave" width="22%" />
              <Skeleton variant="text" animation="wave" width="14%" />
              <Skeleton variant="text" animation="wave" width="10%" />
              <Skeleton variant="text" animation="wave" width="34%" />
            </Stack>
          ))}
        </WorkbenchSkeletonPanel>

        <Stack spacing={1.5}>
          <WorkbenchSkeletonPanel minHeight={104}>
            <Box sx={{ px: 1.5, py: 1.4 }}>
              <Skeleton variant="text" animation="wave" width="45%" />
              <Skeleton variant="rounded" animation="wave" height={3} sx={{ mt: 1.4 }} />
              <Stack direction="row" spacing={2} sx={{ mt: 1.25 }}>
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} variant="text" animation="wave" width={30} />
                ))}
              </Stack>
            </Box>
          </WorkbenchSkeletonPanel>
          <WorkbenchSkeletonPanel minHeight={90}>
            <Box sx={{ px: 1.5, py: 1.35 }}>
              <Skeleton variant="text" animation="wave" width="55%" />
              <Skeleton variant="text" animation="wave" width="35%" sx={{ mt: 1 }} />
            </Box>
          </WorkbenchSkeletonPanel>
          <WorkbenchSkeletonPanel minHeight={140}>
            <Stack divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {Array.from({ length: 3 }, (_, index) => (
                <Box key={index} sx={{ px: 1.5, py: 1.1 }}>
                  <Skeleton variant="text" animation="wave" width="70%" />
                  <Skeleton variant="text" animation="wave" width="40%" />
                </Box>
              ))}
            </Stack>
          </WorkbenchSkeletonPanel>
        </Stack>
      </Box>
    </Stack>
  );
}

function WorkbenchSkeletonPanel({ children, minHeight }: React.PropsWithChildren<{ minHeight?: number }>) {
  return (
    <Box
      sx={{
        minWidth: 0,
        minHeight,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--rc-radius-panel)",
        bgcolor: "background.paper"
      }}
    >
      <Box
        sx={{
          minHeight: 38,
          px: 1.5,
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "var(--rc-surface-2)"
        }}
      >
        <Skeleton variant="text" animation="wave" width={120} />
      </Box>
      {children}
    </Box>
  );
}
