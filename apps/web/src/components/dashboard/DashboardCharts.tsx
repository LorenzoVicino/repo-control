import { Box, Stack, Tooltip, Typography, useTheme } from "@mui/material";
import React from "react";

// Small charts for the dashboard widgets, drawn from the theme rather than a charting
// library. Every mark keeps a 2px surface gap from its neighbour, so adjacent status
// colours read as separate segments without a stroke, and every chart has a text twin
// beside or below it (a legend with counts, a list of rows) so nothing is colour-only.

export type ChartSegment = {
  key: string;
  value: number;
  color: string;
  label: string;
};

const SURFACE_GAP = 2;

type RingChartProps = {
  segments: ChartSegment[];
  size?: number;
  stroke?: number;
  ariaLabel: string;
  // The segment the reader is pointing at (from the ring or its legend); its arc thickens,
  // the others dim, and the hole shows that segment's own count instead of the total.
  activeKey?: string | null;
  onActiveKeyChange?: (key: string | null) => void;
  children?: React.ReactNode;
};

// Part-to-whole under six segments, the one job a ring does better than a bar. Arcs are
// exact shares of the circumference; a segment at zero draws nothing.
export function RingChart({ segments, size = 96, stroke = 12, ariaLabel, activeKey = null, onActiveKeyChange, children }: RingChartProps) {
  const theme = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const occupied = segments.filter((segment) => segment.value > 0);
  const gap = occupied.length > 1 ? SURFACE_GAP : 0;
  let offset = 0;

  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--rc-surface-3)" strokeWidth={stroke} />
        {total > 0 ? occupied.map((segment) => {
          const length = Math.max(0, (segment.value / total) * circumference - gap);
          const dashOffset = -offset;
          offset += (segment.value / total) * circumference;
          const isActive = activeKey === segment.key;
          const isDimmed = activeKey !== null && !isActive;
          return (
            <circle
              key={segment.key}
              data-segment={segment.key}
              data-active={isActive ? "true" : undefined}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={isActive ? stroke + 4 : stroke}
              strokeOpacity={isDimmed ? 0.35 : 1}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset + gap / 2}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={onActiveKeyChange ? () => onActiveKeyChange(segment.key) : undefined}
              onMouseLeave={onActiveKeyChange ? () => onActiveKeyChange(null) : undefined}
              style={{
                cursor: onActiveKeyChange ? "pointer" : undefined,
                transition: `stroke-dasharray ${theme.transitions.duration.short}ms ease, stroke-width ${theme.transitions.duration.shortest}ms ease, stroke-opacity ${theme.transitions.duration.shortest}ms ease`
              }}
            />
          );
        }) : null}
      </svg>
      {children ? (
        <Box sx={{ position: "absolute", inset: stroke, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
          {children}
        </Box>
      ) : null}
    </Box>
  );
}

type StackedBarProps = {
  segments: ChartSegment[];
  // The width the bar represents; defaults to the sum, so a bar can be drawn as a share
  // of a larger maximum when several bars are compared.
  max?: number;
  height?: number;
  ariaLabel?: string;
};

export function StackedBar({ segments, max, height = 8, ariaLabel }: StackedBarProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const scale = max && max > 0 ? max : total;
  const occupied = segments.filter((segment) => segment.value > 0);

  return (
    <Box
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      sx={{ display: "flex", height, width: "100%", borderRadius: height / 2, overflow: "hidden", bgcolor: "var(--rc-surface-3)", gap: `${SURFACE_GAP}px` }}
    >
      {scale > 0 ? occupied.map((segment) => (
        <Box
          key={segment.key}
          data-segment={segment.key}
          sx={{ flexBasis: `${(segment.value / scale) * 100}%`, flexShrink: 1, minWidth: 3, bgcolor: segment.color, transition: "flex-basis var(--rc-motion-base) ease" }}
        />
      )) : null}
    </Box>
  );
}

export type ChartColumn = {
  key: string;
  value: number;
  color: string;
  // What the hover layer says about this column.
  title: React.ReactNode;
  emphasis?: boolean;
};

type ColumnChartProps = {
  columns: ChartColumn[];
  height?: number;
  ariaLabel: string;
};

// Columns grow from a shared hairline baseline; the tallest fills the plot height. A
// column at zero keeps its slot as a hairline mark so the time axis stays continuous.
export function ColumnChart({ columns, height = 52, ariaLabel }: ColumnChartProps) {
  const max = Math.max(0, ...columns.map((column) => column.value));

  return (
    <Box role="img" aria-label={ariaLabel} sx={{ position: "relative", height, display: "flex", alignItems: "flex-end", gap: `${SURFACE_GAP}px` }}>
      <Box aria-hidden="true" sx={{ position: "absolute", left: 0, right: 0, bottom: 0, borderBottom: "1px solid", borderColor: "divider" }} />
      {columns.map((column) => {
        const share = max > 0 ? column.value / max : 0;
        const columnHeight = column.value > 0 ? Math.max(3, Math.round(share * (height - 2))) : 2;
        return (
          <Tooltip key={column.key} title={column.title} placement="top" enterDelay={80} disableInteractive>
            <Box
              data-column={column.key}
              data-emphasis={column.emphasis ? "true" : undefined}
              sx={{
                flex: "1 1 0",
                maxWidth: 24,
                minWidth: 4,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                cursor: "default",
                "&:hover > span": { filter: "brightness(1.15)" }
              }}
            >
              <Box
                component="span"
                sx={{
                  display: "block",
                  width: "100%",
                  height: columnHeight,
                  bgcolor: column.value > 0 ? column.color : "var(--rc-surface-3)",
                  opacity: column.emphasis === false ? 0.55 : 1,
                  borderRadius: "4px 4px 0 0",
                  transition: "filter var(--rc-motion-fast) ease"
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

type InlineBarProps = {
  segments: ChartSegment[];
  max: number;
  width?: number;
};

// A bar that sits in a list row and compares the row with its neighbours.
export function InlineBar({ segments, max, width = 56 }: InlineBarProps) {
  return (
    <Box sx={{ width, flexShrink: 0 }}>
      <StackedBar segments={segments} max={max} height={6} />
    </Box>
  );
}

type ChartLegendProps = {
  items: Array<{ key: string; color: string; label: string; value?: React.ReactNode; muted?: boolean }>;
  dense?: boolean;
  activeKey?: string | null;
  // When given, legend rows become focusable and pointing at (or focusing) one names it
  // active, so keyboards reach the same reading the ring offers on hover.
  onActiveKeyChange?: (key: string | null) => void;
};

export function ChartLegend({ items, dense = false, activeKey = null, onActiveKeyChange }: ChartLegendProps) {
  return (
    <Stack component="ul" spacing={dense ? 0.2 : 0.4} sx={{ listStyle: "none", m: 0, p: 0, minWidth: 0 }}>
      {items.map((item) => (
        <Stack
          key={item.key}
          component="li"
          direction="row"
          alignItems="center"
          spacing={0.9}
          data-legend-key={item.key}
          data-active={activeKey === item.key ? "true" : undefined}
          tabIndex={onActiveKeyChange && !item.muted ? 0 : undefined}
          onMouseEnter={onActiveKeyChange && !item.muted ? () => onActiveKeyChange(item.key) : undefined}
          onMouseLeave={onActiveKeyChange ? () => onActiveKeyChange(null) : undefined}
          onFocus={onActiveKeyChange && !item.muted ? () => onActiveKeyChange(item.key) : undefined}
          onBlur={onActiveKeyChange ? () => onActiveKeyChange(null) : undefined}
          sx={{
            minHeight: dense ? 18 : 20,
            px: onActiveKeyChange ? 0.5 : 0,
            mx: onActiveKeyChange ? -0.5 : 0,
            borderRadius: "4px",
            cursor: onActiveKeyChange && !item.muted ? "default" : undefined,
            bgcolor: activeKey === item.key ? "var(--rc-surface-2)" : "transparent",
            opacity: activeKey !== null && activeKey !== item.key ? 0.6 : 1,
            transition: "background-color var(--rc-motion-fast) ease, opacity var(--rc-motion-fast) ease"
          }}
        >
          <Box aria-hidden="true" component="span" sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: item.color, flexShrink: 0 }} />
          <Typography variant="caption" noWrap sx={{ flexGrow: 1, minWidth: 0, color: item.muted ? "text.secondary" : "text.primary" }}>
            {item.label}
          </Typography>
          {item.value !== undefined ? (
            <Typography component="span" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 10.5, fontVariantNumeric: "tabular-nums", color: item.muted ? "text.secondary" : "text.primary" }}>
              {item.value}
            </Typography>
          ) : null}
        </Stack>
      ))}
    </Stack>
  );
}
