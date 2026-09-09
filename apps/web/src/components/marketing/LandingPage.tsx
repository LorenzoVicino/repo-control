import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import GitHub from "@mui/icons-material/GitHub";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import TerminalRounded from "@mui/icons-material/TerminalRounded";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";

const features = [
  ["Triage before you tab-hop", "See dirty trees, branch drift, Docker health and unfinished work across the workspace at a glance."],
  ["Act with context already loaded", "Open Git, branches, a terminal and Compose controls already scoped to the repository you chose."],
  ["Keep your agent context private", "Search and resume local Codex, Claude Code and Gemini CLI sessions—without sending their history anywhere."],
];

function WorkspacePreview() {
  const repositories = [
    ["atlas-api", "2 modified · 1 ahead", "Needs attention", "#f4b45f"],
    ["storefront", "main · synced", "Ready", "#70d6a3"],
    ["infra", "3 behind · Docker running", "Review", "#8ec8ff"],
  ];

  return (
    <Box aria-label="Preview of the repo-control workspace" sx={{ width: "100%", bgcolor: "#111926", border: "1px solid rgba(180, 212, 247, .22)", borderRadius: 2, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.32)" }}>
      <Box sx={{ minHeight: 44, px: 1.5, display: "flex", alignItems: "center", gap: .75, bgcolor: "#182334", borderBottom: "1px solid rgba(180, 212, 247, .13)" }}>
        {["#f28b82", "#f4b45f", "#70d6a3"].map((color) => <Box key={color} sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: color }} />)}
        <Typography sx={{ ml: 1, color: "#92a2bc", fontSize: 10, fontFamily: "var(--rc-font-mono)" }}>workspace / dashboard</Typography>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "130px 1fr" }, minHeight: 292 }}>
        <Box sx={{ p: 1.5, borderRight: { sm: "1px solid rgba(180, 212, 247, .13)" }, borderBottom: { xs: "1px solid rgba(180, 212, 247, .13)", sm: 0 }, color: "#8293ae" }}>
          <Typography sx={{ color: "#eaf1fb", fontSize: 11, fontWeight: 700, mb: 1.5 }}>REPO CONTROL</Typography>
          {["Overview", "Repositories", "Agent sessions", "Docker", "Automations"].map((item, index) => <Box key={item} sx={{ px: .8, py: .6, mb: .35, borderRadius: .8, bgcolor: index === 0 ? "rgba(142,200,255,.13)" : "transparent", color: index === 0 ? "#cce8ff" : "inherit", fontSize: 10 }}>{item}</Box>)}
        </Box>
        <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box><Typography fontWeight={700} sx={{ fontSize: { xs: 16, sm: 18 } }}>Your attention, organized.</Typography><Typography sx={{ color: "#90a0b9", fontSize: 10.5, mt: .4 }}>3 repositories need a decision.</Typography></Box>
            <Chip label="7 repos" size="small" sx={{ color: "#b6dfff", border: "1px solid rgba(142,200,255,.25)", bgcolor: "transparent", fontSize: 10 }} />
          </Stack>
          <Stack spacing={.8} sx={{ mt: 2 }}>
            {repositories.map(([name, meta, state, color]) => <Box key={name} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 1.25, py: 1, border: "1px solid rgba(180, 212, 247, .12)", borderRadius: 1, bgcolor: "#162133" }}><Box><Typography sx={{ fontFamily: "var(--rc-font-mono)", fontSize: 11, color: "#e6effc" }}>{name}</Typography><Typography sx={{ color: "#8e9cb4", fontSize: 9.5, mt: .25 }}>{meta}</Typography></Box><Typography sx={{ color, fontSize: 9.5, fontWeight: 700 }}>{state}</Typography></Box>)}
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

export function LandingPage() {
  const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#101522", color: "#f3f6fb", overflow: "hidden" }}>
      <Box component="header" sx={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
        <Container maxWidth="lg" sx={{ minHeight: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box component="img" src={asset("icon/repo-control-icon.svg")} alt="repo-control" sx={{ width: 32, height: 32 }} />
            <Typography fontWeight={700} letterSpacing="-.03em">repo-control</Typography>
          </Stack>
          <Button href="https://github.com/LorenzoVicino/repo-control" target="_blank" rel="noreferrer" color="inherit" startIcon={<GitHub />} sx={{ textTransform: "none" }}>
            View on GitHub
          </Button>
        </Container>
      </Box>

      <Container maxWidth="lg" component="main" sx={{ pt: { xs: 7, md: 11 }, pb: { xs: 8, md: 12 } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, .95fr) minmax(440px, 1.05fr)" }, alignItems: "center", gap: { xs: 6, lg: 7 } }}>
          <Stack spacing={3.2} alignItems="flex-start">
            <Chip icon={<TerminalRounded />} label="The local-first command center" sx={{ bgcolor: "rgba(135, 194, 255, .12)", color: "#b5dcff", border: "1px solid rgba(135, 194, 255, .22)", fontWeight: 600 }} />
            <Typography component="h1" sx={{ fontSize: { xs: "3.2rem", sm: "4.5rem", md: "5.2rem" }, lineHeight: .97, letterSpacing: "-.065em", fontWeight: 750 }}>
              Stop rebuilding your workspace in your head.
          </Typography>
          <Typography sx={{ maxWidth: 565, fontSize: { xs: "1.08rem", md: "1.18rem" }, lineHeight: 1.65, color: "#b7c0d4" }}>
            Your terminal knows one repository at a time. repo-control sees the whole workspace, shows what needs you now, and keeps every action inside the right boundary.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
            <Button href="#/demo" variant="contained" endIcon={<PlayArrowRounded />} size="large" sx={{ px: 2.5, py: 1.35, bgcolor: "#8ec8ff", color: "#08111f", fontWeight: 700, textTransform: "none", "&:hover": { bgcolor: "#b5dcff" } }}>
              See your next workspace
            </Button>
            <Button href="https://github.com/LorenzoVicino/repo-control#try-it-in-one-command" target="_blank" rel="noreferrer" variant="outlined" endIcon={<ArrowForwardRounded />} size="large" sx={{ px: 2.5, py: 1.35, borderColor: "rgba(255,255,255,.24)", color: "#f3f6fb", fontWeight: 600, textTransform: "none" }}>
              Install locally
            </Button>
          </Stack>
          <Typography variant="body2" sx={{ color: "#8490aa", fontFamily: "var(--rc-font-mono)", fontSize: 12 }}>Free, open source, and runs on your machine.</Typography>
          </Stack>
          <WorkspacePreview />
        </Box>

        <Box sx={{ mt: { xs: 9, md: 13 }, mb: { xs: 6, md: 8 }, maxWidth: 720 }}>
          <Typography sx={{ color: "#8ec8ff", fontFamily: "var(--rc-font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".12em" }}>LESS TAB-HOPPING. MORE SHIPPING.</Typography>
          <Typography variant="h3" sx={{ mt: 1.25, fontSize: { xs: "2rem", md: "2.65rem" }, letterSpacing: "-.045em", fontWeight: 700 }}>One calm place for the state that slows your work down.</Typography>
        </Box>
        <Box sx={{ borderTop: "1px solid rgba(255,255,255,.14)", borderBottom: "1px solid rgba(255,255,255,.14)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
          {features.map(([title, description], index) => (
            <Box key={title} sx={{ p: { xs: 3, md: 4 }, borderRight: { md: index < 2 ? "1px solid rgba(255,255,255,.14)" : 0 }, borderBottom: { xs: index < 2 ? "1px solid rgba(255,255,255,.14)" : 0, md: 0 } }}>
              <Stack spacing={1.5}>
                <CheckRounded sx={{ color: "#8ec8ff", fontSize: 20 }} />
                <Typography variant="h6" fontWeight={700}>{title}</Typography>
                <Typography variant="body2" sx={{ color: "#aeb8cb", lineHeight: 1.65 }}>{description}</Typography>
              </Stack>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: { xs: 8, md: 12 }, p: { xs: 3, md: 5 }, bgcolor: "#171f30", border: "1px solid rgba(142,200,255,.22)", borderRadius: 2, display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, justifyContent: "space-between", gap: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>Open it once. Know where to start.</Typography>
            <Typography sx={{ color: "#aeb8cb" }}>No cloud workspace. No fictional productivity theater. Just your machine, your repositories and the next safe move.</Typography>
          </Box>
          <Button href="#/demo" variant="text" color="inherit" endIcon={<ArrowForwardRounded />} sx={{ flexShrink: 0, fontWeight: 700, textTransform: "none" }}>Open demo</Button>
        </Box>
      </Container>
    </Box>
  );
}
