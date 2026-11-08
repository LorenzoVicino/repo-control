import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Alert, Box, Button, Chip, CircularProgress, InputBase, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { enableSemanticSearch, fetchKnowledgeRepositories, fetchKnowledgeStatus, reindexKnowledge, searchKnowledge } from "../../api/knowledge";
import { MONO_FONT_FAMILY } from "../../theme";
import type { KnowledgeHit, KnowledgeRepository, KnowledgeStatus, LabelKind, RepositoryLabel } from "../../types/knowledge";
import { glassSurface } from "../assistant/glass";
import { countLabels, splitHighlights } from "./labels";

type KnowledgePageProps = {
  onOpenProject: (projectId: string) => void;
};

const KIND_TONES: Record<LabelKind, "primary" | "info" | "success" | "warning" | "secondary"> = {
  kind: "primary",
  language: "info",
  framework: "success",
  topic: "warning",
  tooling: "secondary"
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function LabelChip({ label, selected = false, count, onClick }: { label: Pick<RepositoryLabel, "id" | "kind"> & { evidence?: string }; selected?: boolean; count?: number; onClick?: () => void }) {
  const tone = KIND_TONES[label.kind];
  const chip = (
    <Chip
      size="small"
      label={count === undefined ? label.id : `${label.id} · ${count}`}
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      sx={(theme: Theme) => ({
        height: 24,
        borderRadius: 999,
        fontSize: "0.74rem",
        bgcolor: alpha(theme.palette[tone].main, selected ? 0.32 : 0.12),
        color: theme.palette.mode === "light" ? theme.palette[tone].dark : theme.palette[tone].light,
        border: `1px solid ${alpha(theme.palette[tone].main, selected ? 0.7 : 0.22)}`
      })}
    />
  );
  return label.evidence ? <Tooltip title={label.evidence}>{chip}</Tooltip> : chip;
}

function Snippet({ text }: { text: string }) {
  return (
    <Box component="span" sx={{ overflowWrap: "anywhere" }}>
      {splitHighlights(text.replace(/\s+/g, " ")).map((part, index) =>
        part.match ? (
          <Box key={index} component="mark" sx={(theme) => ({ bgcolor: alpha(theme.palette.warning.main, 0.28), color: "inherit", borderRadius: 0.5, px: 0.25 })}>
            {part.text}
          </Box>
        ) : (
          <React.Fragment key={index}>{part.text}</React.Fragment>
        )
      )}
    </Box>
  );
}

export function KnowledgePage({ onOpenProject }: KnowledgePageProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [selectedLabel, setSelectedLabel] = React.useState<string | null>(null);
  const debouncedQuery = useDebounced(query.trim(), 300);
  const autoIndexed = React.useRef(false);

  const status = useQuery({
    queryKey: ["knowledge-status"],
    queryFn: () => fetchKnowledgeStatus(t("knowledge.errors.status")),
    refetchInterval: (current) => (current.state.data?.state === "indexing" || current.state.data?.semantic.install.state === "installing" ? 1200 : false)
  });
  const repositories = useQuery({
    queryKey: ["knowledge-repositories"],
    queryFn: () => fetchKnowledgeRepositories(t("knowledge.errors.repositories")),
    enabled: status.isSuccess
  });
  const search = useQuery({
    queryKey: ["knowledge-search", debouncedQuery],
    queryFn: () => searchKnowledge(debouncedQuery, t("knowledge.errors.search")),
    enabled: debouncedQuery.length >= 2,
    placeholderData: keepPreviousData
  });

  const reindex = useMutation({
    mutationFn: () => reindexKnowledge(t("knowledge.errors.reindex")),
    onSuccess: (next) => queryClient.setQueryData(["knowledge-status"], next)
  });
  const semantic = useMutation({
    mutationFn: () => enableSemanticSearch(t("knowledge.errors.semantic")),
    onSuccess: (next) => queryClient.setQueryData(["knowledge-status"], next)
  });

  const indexing = status.data?.state === "indexing";
  const installing = status.data?.semantic.install.state === "installing";

  // When a run finishes, the labels and any open search are stale.
  const wasBusy = React.useRef(false);
  React.useEffect(() => {
    const busy = indexing || installing;
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-repositories"] });
      void queryClient.invalidateQueries({ queryKey: ["knowledge-search"] });
    }
    wasBusy.current = busy;
  }, [indexing, installing, queryClient]);

  // A workspace that was never indexed is indexed on the first visit.
  React.useEffect(() => {
    if (!autoIndexed.current && status.data && status.data.indexed === 0 && status.data.state === "idle" && !status.data.lastRun) {
      autoIndexed.current = true;
      reindex.mutate();
    }
  }, [status.data, reindex]);

  const all = React.useMemo(() => repositories.data?.repositories ?? [], [repositories.data]);
  const grouped = React.useMemo(() => countLabels(all), [all]);
  const filtered = selectedLabel ? all.filter((repository) => repository.labels.some((label) => label.id === selectedLabel)) : all;
  const formatter = React.useMemo(() => new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }), [i18n.language]);
  const lastIndexed = status.data?.lastRun?.finishedAt;
  const minutesAgo = lastIndexed ? Math.round((new Date(lastIndexed).getTime() - Date.now()) / 60_000) : null;

  return (
    <Box component="section" aria-labelledby="knowledge-title" sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
        <Box sx={{ mr: "auto", flex: "1 1 360px", minWidth: 0 }}>
          <Typography id="knowledge-title" component="h1" variant="h1">{t("knowledge.title")}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.88rem", mt: 0.5 }}>{t("knowledge.subtitle")}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Box role="status" sx={(theme) => ({ ...glassSurface(theme), height: 34, px: 1.5, borderRadius: 999, display: "flex", alignItems: "center", gap: 1, fontSize: "0.8rem", color: "text.secondary" })}>
          {indexing ? <CircularProgress size={12} thickness={6} aria-hidden /> : <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: "success.main" }} />}
          {indexing && status.data?.progress
            ? t("knowledge.status.indexing", { done: status.data.progress.done, total: status.data.progress.total })
            : t("knowledge.status.indexed", { count: status.data?.indexed ?? 0 })}
          {!indexing && minutesAgo !== null ? ` · ${formatter.format(minutesAgo, "minute")}` : ""}
        </Box>
        <Box sx={(theme) => ({ ...glassSurface(theme), height: 34, px: 1.5, borderRadius: 999, display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.78rem", fontFamily: MONO_FONT_FAMILY, color: "text.secondary" })}>
          {status.data?.semantic.enabled ? <AutoAwesomeOutlinedIcon sx={{ fontSize: 14, color: "warning.main" }} aria-hidden /> : null}
          {status.data?.semantic.enabled ? t("knowledge.mode.hybrid") : t("knowledge.mode.text")}
        </Box>
        <Button
          size="small"
          color="inherit"
          startIcon={<RefreshRoundedIcon fontSize="small" />}
          disabled={indexing || installing || reindex.isPending}
          onClick={() => reindex.mutate()}
          sx={(theme) => ({ ...glassSurface(theme), height: 34, px: 1.5, borderRadius: 999 })}
        >
          {t("knowledge.reindex")}
        </Button>
        </Stack>
      </Stack>
      {indexing && status.data?.progress ? (
        <LinearProgress variant="determinate" value={(status.data.progress.done / Math.max(1, status.data.progress.total)) * 100} aria-label={t("knowledge.status.progress")} sx={{ borderRadius: 999, height: 4 }} />
      ) : null}
      {status.isError ? <Alert severity="error">{status.error.message}</Alert> : null}
      {reindex.isError ? <Alert severity="error">{reindex.error.message}</Alert> : null}

      <Box
        component="form"
        role="search"
        onSubmit={(event) => event.preventDefault()}
        sx={(theme) => ({ ...glassSurface(theme, "strong"), borderRadius: 3, px: 2, py: 1.25, display: "flex", alignItems: "center", gap: 1.25, "&:focus-within": { borderColor: theme.palette.primary.main } })}
      >
        <SearchRoundedIcon sx={{ color: "text.secondary" }} aria-hidden />
        <InputBase
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("knowledge.searchPlaceholder")}
          inputProps={{ "aria-label": t("knowledge.searchLabel") }}
          sx={{ flex: 1, fontSize: "1rem" }}
        />
        {search.isFetching ? <CircularProgress size={16} thickness={5} aria-label={t("knowledge.searching")} /> : null}
      </Box>

      {debouncedQuery.length >= 2 ? (
        <SearchResults hits={search.data?.hits ?? []} loading={search.isPending} error={search.error?.message ?? null} query={debouncedQuery} onOpenProject={onOpenProject} />
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 320px" }, gap: 2.5, alignItems: "start" }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box component="section" aria-labelledby="knowledge-labels-title" sx={(theme) => ({ ...glassSurface(theme), borderRadius: 3, p: 2, display: "flex", flexDirection: "column", gap: 1.5 })}>
              <Stack direction="row" sx={{ alignItems: "center" }}>
                <Typography id="knowledge-labels-title" component="h2" variant="h2">{t("knowledge.labels.title")}</Typography>
                {selectedLabel ? (
                  <Button size="small" onClick={() => setSelectedLabel(null)} sx={{ ml: "auto" }}>{t("knowledge.labels.clear")}</Button>
                ) : null}
              </Stack>
              {repositories.isPending ? <LinearProgress aria-label={t("loading.knowledge")} sx={{ borderRadius: 999 }} /> : null}
              {repositories.isError ? <Alert severity="error">{repositories.error.message}</Alert> : null}
              {[...grouped.entries()].map(([kind, labels]) => (
                <Box key={kind} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "110px 1fr" }, gap: 1, alignItems: "start" }}>
                  <Typography sx={{ fontSize: "0.78rem", color: "text.secondary", pt: 0.4 }}>{t(`knowledge.kinds.${kind}`)}</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {labels.map((label) => (
                      <LabelChip key={`${kind}-${label.id}`} label={label} count={label.count} selected={selectedLabel === label.id} onClick={() => setSelectedLabel(selectedLabel === label.id ? null : label.id)} />
                    ))}
                  </Box>
                </Box>
              ))}
              {!grouped.size && !repositories.isPending ? <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>{t("knowledge.labels.empty")}</Typography> : null}
            </Box>

            {repositories.isSuccess ? (
            <Box component="section" aria-labelledby="knowledge-repositories-title" sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              <Typography id="knowledge-repositories-title" component="h2" variant="h2">
                {selectedLabel ? t("knowledge.repositories.withLabel", { label: selectedLabel, count: filtered.length }) : t("knowledge.repositories.title", { count: filtered.length })}
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 1.5 }}>
                {filtered.map((repository) => (
                  <RepositoryCard key={repository.id} repository={repository} selectedLabel={selectedLabel} onOpenProject={onOpenProject} />
                ))}
              </Box>
            </Box>
            ) : null}
          </Stack>
          <SemanticCard status={status.data ?? null} pending={semantic.isPending} error={semantic.error?.message ?? null} onEnable={() => semantic.mutate()} />
        </Box>
      )}
    </Box>
  );
}

function RepositoryCard({ repository, selectedLabel, onOpenProject }: { repository: KnowledgeRepository; selectedLabel: string | null; onOpenProject: (id: string) => void }) {
  const { t } = useTranslation();
  const description = repository.summary.split("\n")[0].replace(/^[^:]*:\s*/, "").replace(/\.$/, "");
  const hasDescription = description && description !== repository.summary.split("\n")[0].replace(/\.$/, "");
  return (
    <Box sx={(theme) => ({ ...glassSurface(theme), borderRadius: 2.5, p: 1.75, display: "flex", flexDirection: "column", gap: 1, minWidth: 0 })}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
        <Button
          variant="text"
          onClick={() => onOpenProject(repository.id)}
          aria-label={t("knowledge.open", { name: repository.name })}
          sx={{ p: 0, minWidth: 0, fontFamily: MONO_FONT_FAMILY, fontWeight: 600, fontSize: "0.88rem", textTransform: "none", justifyContent: "flex-start", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {repository.name}
        </Button>
        {repository.relativePath !== repository.name ? <Typography sx={{ fontSize: "0.72rem", color: "text.secondary", fontFamily: MONO_FONT_FAMILY }} noWrap>{repository.relativePath}</Typography> : null}
      </Stack>
      {hasDescription ? <Typography sx={{ fontSize: "0.8rem", color: "text.secondary", lineHeight: 1.45 }}>{description}</Typography> : null}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {repository.labels.slice(0, 8).map((label) => (
          <LabelChip key={`${label.kind}-${label.id}`} label={label} selected={label.id === selectedLabel} />
        ))}
      </Box>
    </Box>
  );
}

function SearchResults({ hits, loading, error, query, onOpenProject }: { hits: KnowledgeHit[]; loading: boolean; error: string | null; query: string; onOpenProject: (id: string) => void }) {
  const { t } = useTranslation();
  if (error) return <Alert severity="error">{error}</Alert>;
  if (loading) return <LinearProgress aria-label={t("knowledge.searching")} sx={{ borderRadius: 999 }} />;
  if (!hits.length) return <Typography sx={{ color: "text.secondary" }}>{t("knowledge.noResults", { query })}</Typography>;
  return (
    <Box component="ol" aria-label={t("knowledge.resultsLabel", { query })} sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {hits.map((hit) => (
        <Box component="li" key={hit.id} sx={(theme) => ({ ...glassSurface(theme), borderRadius: 2.5, p: 2, display: "flex", flexDirection: "column", gap: 1 })}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.75 }}>
            <Button
              variant="text"
              onClick={() => onOpenProject(hit.id)}
              aria-label={t("knowledge.open", { name: hit.name })}
              sx={{ p: 0, minWidth: 0, fontFamily: MONO_FONT_FAMILY, fontWeight: 600, textTransform: "none" }}
            >
              {hit.name}
            </Button>
            {hit.labels.slice(0, 6).map((label) => (
              <LabelChip key={`${label.kind}-${label.id}`} label={label} />
            ))}
            <Box sx={{ ml: "auto !important", display: "flex", gap: 0.5 }}>
              {hit.via.map((via) => (
                <Box key={via} component="span" sx={(theme) => ({ fontSize: "0.68rem", px: 0.75, py: 0.15, borderRadius: 999, border: `1px solid ${theme.palette.divider}`, color: "text.secondary" })}>
                  {t(`knowledge.via.${via}`)}
                </Box>
              ))}
            </Box>
          </Stack>
          {hit.matches.map((match, index) => (
            <Box key={index} sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "150px 1fr" }, gap: { xs: 0.25, sm: 1.5 }, fontSize: "0.82rem", lineHeight: 1.5 }}>
              <Box component="span" sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: "0.74rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={match.path || undefined}>
                {match.path || t(`knowledge.chunkKinds.${match.kind}`)}
              </Box>
              <Snippet text={match.snippet} />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function SemanticCard({ status, pending, error, onEnable }: { status: KnowledgeStatus | null; pending: boolean; error: string | null; onEnable: () => void }) {
  const { t } = useTranslation();
  if (!status) return null;
  const { semantic } = status;
  const installing = semantic.install.state === "installing" || pending;
  return (
    <Box component="aside" aria-labelledby="knowledge-semantic-title" sx={(theme) => ({ ...glassSurface(theme), borderRadius: 3, p: 2, display: "flex", flexDirection: "column", gap: 1.25, position: { lg: "sticky" }, top: { lg: 16 } })}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <AutoAwesomeOutlinedIcon fontSize="small" sx={{ color: "warning.main" }} aria-hidden />
        <Typography id="knowledge-semantic-title" component="h2" variant="h2">{t("knowledge.semantic.title")}</Typography>
      </Stack>
      {semantic.enabled ? (
        <>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary" }}>{t("knowledge.semantic.on")}</Typography>
          <Box component="code" sx={{ fontFamily: MONO_FONT_FAMILY, fontSize: "0.74rem", wordBreak: "break-all" }}>{semantic.model}</Box>
        </>
      ) : (
        <>
          <Typography sx={{ fontSize: "0.85rem", color: "text.secondary", lineHeight: 1.5 }}>{t("knowledge.semantic.off")}</Typography>
          {semantic.installable ? (
            <Button variant="contained" disableElevation disabled={installing} onClick={onEnable} startIcon={installing ? <CircularProgress size={14} color="inherit" /> : undefined} sx={{ borderRadius: 999, alignSelf: "flex-start" }}>
              {installing ? t("knowledge.semantic.installing") : t("knowledge.semantic.enable")}
            </Button>
          ) : (
            <Typography sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{t("knowledge.semantic.unavailable")}</Typography>
          )}
          {semantic.install.state === "failed" || error ? (
            <Alert severity="error" variant="outlined" sx={{ whiteSpace: "pre-wrap", fontSize: "0.78rem" }}>{error ?? semantic.install.message}</Alert>
          ) : null}
        </>
      )}
    </Box>
  );
}
