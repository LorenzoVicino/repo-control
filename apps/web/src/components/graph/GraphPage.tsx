import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Box, Button, Chip, CircularProgress, IconButton, InputBase, Stack, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { fetchWorkspaceGraph } from "../../api/knowledge";
import { MONO_FONT_FAMILY } from "../../theme";
import type { GraphEdgeType } from "../../types/graph";
import { glassSurface } from "../assistant/glass";
import { graphColors } from "./graphColors";
import { buildGraph, findRepositories, relationsFor, type GraphColors, type Relation } from "./graphModel";

const GraphCanvas = React.lazy(async () => ({ default: (await import("./GraphCanvas")).GraphCanvas }));

type GraphPageProps = {
  onOpenProject: (projectId: string) => void;
  onAskAgent: (prompt: string) => void;
};

const RELATION_TYPES: GraphEdgeType[] = ["depends_on", "references", "similar"];


export function GraphPage({ onOpenProject, onAskAgent }: GraphPageProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visibleEdges, setVisibleEdges] = React.useState<Set<GraphEdgeType>>(() => new Set<GraphEdgeType>(["depends_on", "references", "similar", "labelled"]));
  const [showLabels, setShowLabels] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [webglUnavailable, setWebglUnavailable] = React.useState(false);

  const data = useQuery({ queryKey: ["knowledge-graph"], queryFn: () => fetchWorkspaceGraph(t("graph.errors.load")), staleTime: 30_000 });
  const colors = React.useMemo(() => graphColors(theme), [theme]);
  const graph = React.useMemo(() => (data.data ? buildGraph(data.data, colors) : null), [data.data, colors]);
  const relations = data.data && selected ? relationsFor(data.data, selected) : null;
  const matches = data.data && query.trim() ? findRepositories(data.data, query).slice(0, 6) : [];
  const counts = React.useMemo(() => {
    const result: Record<GraphEdgeType, number> = { depends_on: 0, references: 0, similar: 0, labelled: 0 };
    for (const edge of data.data?.edges ?? []) result[edge.type] += 1;
    return result;
  }, [data.data]);
  const repositoryCount = data.data?.nodes.filter((node) => node.type === "repository").length ?? 0;

  const toggleEdge = (type: GraphEdgeType) =>
    setVisibleEdges((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  return (
    <Box component="section" aria-labelledby="graph-title" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-end", flexWrap: "wrap", rowGap: 1.5 }}>
        <Box sx={{ mr: "auto", flex: "1 1 320px" }}>
          <Typography id="graph-title" component="h1" variant="h1">{t("graph.title")}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.88rem", mt: 0.5 }}>
            {data.data ? t("graph.subtitle", { repositories: repositoryCount, relations: counts.depends_on + counts.references + counts.similar }) : t("graph.loading")}
          </Typography>
        </Box>
        <Box sx={{ position: "relative", flex: "0 1 300px", minWidth: 220 }}>
          <Box sx={(muiTheme) => ({ ...glassSurface(muiTheme), borderRadius: 999, px: 1.5, height: 38, display: "flex", alignItems: "center", gap: 1 })}>
            <SearchRoundedIcon fontSize="small" sx={{ color: "text.secondary" }} aria-hidden />
            <InputBase
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  setSelected(matches[0].id);
                  setQuery("");
                }
              }}
              placeholder={t("graph.find")}
              inputProps={{ "aria-label": t("graph.find") }}
              sx={{ flex: 1, fontSize: "0.88rem" }}
            />
          </Box>
          {matches.length ? (
            <Box component="ul" role="listbox" aria-label={t("graph.matches")} sx={(muiTheme) => ({ ...glassSurface(muiTheme, "strong"), position: "absolute", zIndex: 5, top: 44, left: 0, right: 0, m: 0, p: 0.5, listStyle: "none", borderRadius: 2 })}>
              {matches.map((match) => (
                <Box
                  key={match.id}
                  component="li"
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => {
                    setSelected(match.id);
                    setQuery("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSelected(match.id);
                      setQuery("");
                    }
                  }}
                  sx={(muiTheme) => ({ px: 1.25, py: 0.75, borderRadius: 1.5, cursor: "pointer", fontFamily: MONO_FONT_FAMILY, fontSize: "0.82rem", "&:hover, &:focus-visible": { bgcolor: muiTheme.palette.action.hover, outline: "none" } })}
                >
                  {match.name}
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }} role="group" aria-label={t("graph.filters")}>
        {RELATION_TYPES.map((type) => (
          <Chip
            key={type}
            label={`${t(`graph.edges.${type}`)} · ${counts[type]}`}
            onClick={() => toggleEdge(type)}
            aria-pressed={visibleEdges.has(type)}
            disabled={!counts[type]}
            icon={<Box component="span" aria-hidden sx={{ width: 14, height: 3, borderRadius: 2, bgcolor: colors.edges[type], ml: "10px !important" }} />}
            variant={visibleEdges.has(type) ? "filled" : "outlined"}
            sx={(muiTheme) => ({ ...(visibleEdges.has(type) ? glassSurface(muiTheme) : {}), borderRadius: 999, "& .MuiChip-icon": { mr: "-2px" }, "& .MuiChip-label": { pl: 1 } })}
          />
        ))}
        <Chip
          label={t("graph.labels")}
          onClick={() => setShowLabels((value) => !value)}
          aria-pressed={showLabels}
          variant={showLabels ? "filled" : "outlined"}
          sx={(muiTheme) => ({ ...(showLabels ? glassSurface(muiTheme) : {}), borderRadius: 999 })}
        />
        {!counts.similar ? (
          <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", display: "inline-flex", alignItems: "center", gap: 0.5 }}>
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} aria-hidden />
            {t("graph.similarHint")}
          </Typography>
        ) : null}
      </Stack>

      {data.isError ? <Alert severity="error">{data.error.message}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: relations ? "minmax(0, 1fr) 340px" : "1fr" }, gap: 2, alignItems: "stretch" }}>
        <Box sx={(muiTheme) => ({ ...glassSurface(muiTheme), position: "relative", borderRadius: 3, overflow: "hidden", height: { xs: 460, md: "calc(100dvh - 300px)" }, minHeight: 420 })}>
          {graph && webglUnavailable ? (
            <Centered>
              <Typography sx={{ color: "text.secondary", maxWidth: 360, textAlign: "center", fontSize: "0.88rem" }}>{t("graph.noWebgl")}</Typography>
            </Centered>
          ) : graph ? (
            <React.Suspense fallback={<Centered><CircularProgress size={24} aria-label={t("graph.loading")} /></Centered>}>
              <GraphCanvas
                graph={graph}
                visibleEdges={visibleEdges}
                showLabels={showLabels}
                selected={selected}
                onSelect={setSelected}
                onUnavailable={() => setWebglUnavailable(true)}
                ariaLabel={t("graph.canvas", { count: repositoryCount })}
              />
            </React.Suspense>
          ) : (
            <Centered>{data.isPending ? <CircularProgress size={24} aria-label={t("graph.loading")} /> : null}</Centered>
          )}
          {graph && repositoryCount === 0 ? <Centered><Typography sx={{ color: "text.secondary" }}>{t("graph.empty")}</Typography></Centered> : null}
          <Legend colors={colors} />
        </Box>

        {relations ? (
          <Box component="aside" aria-label={t("graph.details", { name: relations.node.name })} sx={(muiTheme) => ({ ...glassSurface(muiTheme), borderRadius: 3, p: 2, display: "flex", flexDirection: "column", gap: 1.5, maxHeight: { lg: "calc(100dvh - 300px)" }, overflowY: "auto" })}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography component="h2" sx={{ fontFamily: MONO_FONT_FAMILY, fontWeight: 600, fontSize: "0.95rem", overflowWrap: "anywhere" }}>{relations.node.name}</Typography>
              <IconButton size="small" aria-label={t("graph.close")} onClick={() => setSelected(null)} sx={{ ml: "auto !important" }}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
            {relations.node.type === "repository" ? (
              <>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                  <Button size="small" variant="contained" disableElevation sx={{ borderRadius: 999 }} onClick={() => onOpenProject(relations.node.id)}>
                    {t("graph.open")}
                  </Button>
                  <Button size="small" variant="outlined" color="inherit" sx={{ borderRadius: 999 }} startIcon={<AutoAwesomeOutlinedIcon fontSize="small" />} onClick={() => onAskAgent(t("graph.askPrompt", { name: relations.node.name }))}>
                    {t("graph.ask")}
                  </Button>
                </Stack>
                <RelationList title={t("graph.relations.dependsOn")} items={relations.dependsOn} onSelect={setSelected} />
                <RelationList title={t("graph.relations.usedBy")} items={relations.usedBy} onSelect={setSelected} />
                <RelationList title={t("graph.relations.mentions")} items={relations.mentions} onSelect={setSelected} />
                <RelationList title={t("graph.relations.mentionedBy")} items={relations.mentionedBy} onSelect={setSelected} />
                <RelationList title={t("graph.relations.similar")} items={relations.similar} onSelect={setSelected} />
                <RelationList title={t("graph.relations.labels")} items={relations.labelled} onSelect={setSelected} compact />
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: "0.82rem", color: "text.secondary" }}>{t(`knowledge.kinds.${relations.node.labelKind}`)}</Typography>
                <RelationList title={t("graph.relations.carriedBy", { count: relations.labelled.length })} items={relations.labelled} onSelect={setSelected} />
              </>
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{children}</Box>;
}

function Legend({ colors }: { colors: GraphColors }) {
  const { t } = useTranslation();
  const kinds: Array<[string, string]> = [["web app", colors.repository["web app"]], ["api", colors.repository.api], ["library", colors.repository.library], ["cli", colors.repository.cli], ["mobile", colors.repository.mobile], ["documentation", colors.repository.documentation]];
  return (
    <Box aria-label={t("graph.legend")} role="list" sx={(muiTheme) => ({ ...glassSurface(muiTheme, "strong"), position: "absolute", left: 12, bottom: 12, borderRadius: 2, px: 1.25, py: 1, display: "flex", flexWrap: "wrap", gap: 1.25, maxWidth: "calc(100% - 24px)", fontSize: "0.72rem", color: "text.secondary" })}>
      {kinds.map(([kind, color]) => (
        <Box key={kind} role="listitem" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
          <Box aria-hidden sx={{ width: 9, height: 9, borderRadius: 999, bgcolor: color }} />
          {kind}
        </Box>
      ))}
      <Box role="listitem" sx={{ display: "inline-flex", alignItems: "center", gap: 0.6 }}>
        <Box aria-hidden sx={{ width: 7, height: 7, borderRadius: 999, bgcolor: colors.label }} />
        {t("graph.labelNode")}
      </Box>
    </Box>
  );
}

function RelationList({ title, items, onSelect, compact = false }: { title: string; items: Relation[]; onSelect: (id: string) => void; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <Box>
      <Typography component="h3" sx={{ fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", mb: 0.75 }}>{title} · {items.length}</Typography>
      {compact ? (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {items.map((item) => (
            <Chip key={item.id} size="small" label={item.name} onClick={() => onSelect(item.id)} title={item.evidence.join("; ")} sx={{ height: 24, borderRadius: 999, fontSize: "0.74rem" }} />
          ))}
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {items.map((item) => (
            <Box key={item.id}>
              <Button variant="text" size="small" onClick={() => onSelect(item.id)} sx={{ p: 0, minWidth: 0, fontFamily: MONO_FONT_FAMILY, textTransform: "none", fontWeight: 600 }}>
                {item.name}
              </Button>
              <Typography sx={{ fontSize: "0.76rem", color: "text.secondary", lineHeight: 1.4 }}>{item.evidence.join(" · ")}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
