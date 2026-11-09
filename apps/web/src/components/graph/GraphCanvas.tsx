import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type Graph from "graphology";
import * as React from "react";
import Sigma from "sigma";
import { MONO_FONT_FAMILY } from "../../theme";
import type { GraphEdgeType } from "../../types/graph";
import type { EdgeAttributes, NodeAttributes } from "./graphModel";

type GraphCanvasProps = {
  graph: Graph<NodeAttributes, EdgeAttributes>;
  visibleEdges: ReadonlySet<GraphEdgeType>;
  showLabels: boolean;
  selected: string | null;
  onSelect: (node: string | null) => void;
  /** Called when the browser cannot draw WebGL; the page then works without the canvas. */
  onUnavailable: () => void;
  ariaLabel: string;
};

// The WebGL view. Everything visual that changes with interaction (hover, selection, filters)
// goes through sigma's reducers, so the graph itself is never mutated after layout.
export function GraphCanvas({ graph, visibleEdges, showLabels, selected, onSelect, onUnavailable, ariaLabel }: GraphCanvasProps) {
  const theme = useTheme();
  const container = React.useRef<HTMLDivElement | null>(null);
  const sigma = React.useRef<Sigma<NodeAttributes, EdgeAttributes> | null>(null);
  const hovered = React.useRef<string | null>(null);
  const state = React.useRef({ visibleEdges, showLabels, selected });
  state.current = { visibleEdges, showLabels, selected };
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;
  const onUnavailableRef = React.useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  React.useEffect(() => {
    if (!container.current) return;
    const muted = theme.palette.mode === "light" ? "#e6e8ee" : "#22273a";
    const focusOf = () => hovered.current ?? state.current.selected;

    let renderer: Sigma<NodeAttributes, EdgeAttributes>;
    try {
      renderer = new Sigma<NodeAttributes, EdgeAttributes>(graph, container.current, {
      renderEdgeLabels: false,
      // The container is briefly zero-sized while sections switch; sigma must not throw then.
      allowInvalidContainer: true,
      labelFont: MONO_FONT_FAMILY,
      labelSize: 12,
      labelWeight: "500",
      labelColor: { color: theme.palette.text.primary },
      labelRenderedSizeThreshold: 7,
      defaultEdgeType: "arrow",
      zIndex: true,
      minCameraRatio: 0.08,
      maxCameraRatio: 3,
      nodeReducer: (node, data) => {
        const { showLabels: labelsOn } = state.current;
        if (data.nodeType === "label" && !labelsOn) return { ...data, hidden: true };
        const focus = focusOf();
        if (!focus) return data;
        // Sigma's hover box is white, which hides a light label; a bigger node marks the focus instead.
        if (node === focus) return { ...data, size: data.size * 1.5, zIndex: 2, forceLabel: true };
        if (graph.hasEdge(node, focus) || graph.hasEdge(focus, node)) return { ...data, zIndex: 1, forceLabel: data.nodeType === "repository" };
        return { ...data, color: muted, label: "", zIndex: 0 };
      },
      edgeReducer: (edge, data) => {
        const { visibleEdges: shown, showLabels: labelsOn } = state.current;
        if (!shown.has(data.edgeType) || (data.edgeType === "labelled" && !labelsOn)) return { ...data, hidden: true };
        const focus = focusOf();
        if (!focus) return data;
        const [source, target] = graph.extremities(edge);
        return source === focus || target === focus ? { ...data, size: data.size * 1.6, zIndex: 1 } : { ...data, color: muted, zIndex: 0 };
      }
      });
    } catch {
      // No WebGL (disabled, blocked or unsupported): sigma cannot render at all.
      onUnavailableRef.current();
      return;
    }

    renderer.on("enterNode", ({ node }) => {
      hovered.current = node;
      if (container.current) container.current.style.cursor = "pointer";
      renderer.refresh({ skipIndexation: true });
    });
    renderer.on("leaveNode", () => {
      hovered.current = null;
      if (container.current) container.current.style.cursor = "default";
      renderer.refresh({ skipIndexation: true });
    });
    renderer.on("clickNode", ({ node }) => onSelectRef.current(node));
    renderer.on("clickStage", () => onSelectRef.current(null));
    sigma.current = renderer;

    return () => {
      renderer.kill();
      sigma.current = null;
    };
  }, [graph, theme]);

  // Filters and selection change only how things are drawn.
  React.useEffect(() => {
    sigma.current?.refresh({ skipIndexation: true });
  }, [visibleEdges, showLabels, selected]);

  // Bring the selected node into view.
  React.useEffect(() => {
    const renderer = sigma.current;
    if (!renderer || !selected || !graph.hasNode(selected)) return;
    const position = renderer.getNodeDisplayData(selected);
    // Large graphs zoom in on the selection; small ones only pan, so neighbours stay in view.
    const ratio = graph.order > 60 ? Math.min(renderer.getCamera().ratio, 0.6) : renderer.getCamera().ratio;
    if (position) void renderer.getCamera().animate({ x: position.x, y: position.y, ratio }, { duration: 450 });
  }, [selected, graph]);

  return <Box ref={container} role="img" aria-label={ariaLabel} sx={{ position: "absolute", inset: 0 }} />;
}
