import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Box, Button, ButtonBase, Skeleton, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import React from "react";
import type { DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";
import type { DashboardSection } from "./DashboardSidebar";
import type { DashboardWidgetSize } from "./dashboardLayout";

// Everything a widget may read or trigger. Widgets that need server data beyond this
// (agent sessions, workflow runs) query it themselves under the same keys the section
// pages use, so navigating on never fetches twice.
export type DashboardWidgetContext = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  recentProjectIds: string[];
  dockerStatus: DockerContainersResponse | undefined;
  isLoadingDocker: boolean;
  workspaceRoot: string;
  scannedAt: number;
  isRefreshing: boolean;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSearch: () => void;
  onPickWorkspace: () => void;
  onRefreshWorkspace: () => void;
};

export type DashboardWidgetProps = {
  size: DashboardWidgetSize;
  titleId: string;
  context: DashboardWidgetContext;
};

export const WIDGET_ROW_HEIGHT = 44;

type WidgetHeaderProps = {
  titleId: string;
  title: string;
  meta?: string;
  action?: { label: string; onClick: () => void };
};

export function WidgetHeader({ titleId, title, meta, action }: WidgetHeaderProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ minHeight: 38, flexShrink: 0, pl: 1.5, pr: action ? 0.5 : 1.5, borderBottom: "1px solid", borderColor: "divider" }}
    >
      <Typography id={titleId} component="h2" variant="h6" noWrap sx={{ flexGrow: 1, minWidth: 0 }}>
        {title}
      </Typography>
      {meta ? (
        <Typography noWrap color="text.secondary" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10, flexShrink: 0 }}>
          {meta}
        </Typography>
      ) : null}
      {action ? (
        <Button size="small" variant="text" endIcon={<ArrowForwardRoundedIcon />} onClick={action.onClick} sx={{ flexShrink: 0, minHeight: 28, px: 1 }}>
          {action.label}
        </Button>
      ) : null}
    </Stack>
  );
}

// The scrolling region of a widget. On the fixed-height desktop grid it scrolls; on a
// phone the grid rows grow to fit and nothing inside a widget needs a second scrollbar.
export function WidgetBody({ children, columns = 1, sx }: React.PropsWithChildren<{ columns?: 1 | 2; sx?: SxProps<Theme> }>) {
  return (
    <Box
      sx={[
        {
          flexGrow: 1,
          minHeight: 0,
          overflowY: { xs: "visible", md: "auto" },
          // On the fixed-height grid the last row can be cut by the frame; fading the edge
          // says "more below" where a hard clip reads as a broken row.
          maskImage: { md: "linear-gradient(to bottom, #000 calc(100% - 22px), transparent)" },
          scrollbarWidth: "thin",
          display: "grid",
          gridTemplateColumns: columns === 2 ? { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } : "minmax(0, 1fr)",
          alignContent: "start",
          columnGap: 0
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
    >
      {children}
    </Box>
  );
}

type WidgetRowProps = {
  onClick?: () => void;
  ariaLabel?: string;
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  minHeight?: number;
};

// One line of a widget list: a leading glyph, a two-line label and a trailing figure.
// Clickable rows are real buttons so keyboards and screen readers get them for free.
export function WidgetRow({ onClick, ariaLabel, leading, primary, secondary, trailing, minHeight = WIDGET_ROW_HEIGHT }: WidgetRowProps) {
  const content = (
    <>
      {leading ? <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0, width: 18, justifyContent: "center" }}>{leading}</Box> : null}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body2" component="div" noWrap sx={{ fontWeight: 500, lineHeight: 1.35 }}>
          {primary}
        </Typography>
        {secondary ? (
          <Typography variant="caption" component="div" noWrap color="text.secondary" sx={{ lineHeight: 1.35 }}>
            {secondary}
          </Typography>
        ) : null}
      </Box>
      {trailing ? <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75 }}>{trailing}</Box> : null}
    </>
  );
  const sx: SxProps<Theme> = {
    width: "100%",
    minHeight,
    display: "flex",
    alignItems: "center",
    gap: 1.1,
    px: 1.5,
    py: 0.5,
    textAlign: "left",
    borderBottom: "1px solid",
    borderColor: "divider",
    "&:last-of-type": { borderBottom: 0 }
  };

  if (!onClick) {
    return <Box sx={sx}>{content}</Box>;
  }

  return (
    <ButtonBase
      onClick={onClick}
      aria-label={ariaLabel}
      sx={{
        ...sx,
        transition: "background-color var(--rc-motion-fast) ease",
        "&:hover": { bgcolor: "action.hover" },
        "&:focus-visible": { outlineOffset: -2 }
      }}
    >
      {content}
    </ButtonBase>
  );
}

export function WidgetFigure({ children, tone }: React.PropsWithChildren<{ tone?: string }>) {
  return (
    <Typography component="span" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5, color: tone ?? "text.secondary", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
      {children}
    </Typography>
  );
}

export function StateDot({ tone, size = 6 }: { tone: string; size?: number }) {
  return <Box aria-hidden="true" component="span" sx={{ display: "inline-block", width: size, height: size, borderRadius: "50%", bgcolor: tone, flexShrink: 0 }} />;
}

type WidgetEmptyProps = {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: { label: string; onClick: () => void; loading?: boolean };
};

// Empty states explain what would appear and, when there is one, offer the step that
// fills them - never a bare "nothing here".
export function WidgetEmpty({ icon, title, hint, action }: WidgetEmptyProps) {
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ px: 1.5, py: 1.5, minHeight: 0 }}>
      <Stack direction="row" spacing={0.9} alignItems="center">
        {icon ? <Box sx={{ display: "flex", color: "text.disabled", "& svg": { fontSize: 18 } }}>{icon}</Box> : null}
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{title}</Typography>
      </Stack>
      {hint ? <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>{hint}</Typography> : null}
      {action ? (
        <Button size="small" variant="outlined" onClick={action.onClick} disabled={action.loading} sx={{ mt: 0.5 }}>
          {action.label}
        </Button>
      ) : null}
    </Stack>
  );
}

export function WidgetError({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <Stack spacing={0.75} alignItems="flex-start" sx={{ px: 1.5, py: 1.5 }} role="alert">
      <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>{message}</Typography>
      <Button size="small" variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={onRetry}>
        {retryLabel}
      </Button>
    </Stack>
  );
}

export function WidgetRowsSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <Box role="status" aria-live="polite">
      <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 1.5, pt: 1, pb: 0.25 }}>
        {label}
      </Typography>
      {Array.from({ length: rows }, (_, index) => (
        <Stack key={index} direction="row" spacing={1.1} alignItems="center" sx={{ minHeight: WIDGET_ROW_HEIGHT, px: 1.5, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: 0 } }}>
          <Skeleton variant="circular" width={14} height={14} animation="wave" />
          <Box sx={{ flexGrow: 1 }}>
            <Skeleton variant="text" animation="wave" width={`${52 + ((index * 17) % 30)}%`} />
            <Skeleton variant="text" animation="wave" width="34%" sx={{ fontSize: "0.7rem" }} />
          </Box>
          <Skeleton variant="text" animation="wave" width={38} />
        </Stack>
      ))}
    </Box>
  );
}
