import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import GitHub from "@mui/icons-material/GitHub";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import TerminalRounded from "@mui/icons-material/TerminalRounded";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";

const features = [
  ["See what needs attention", "Triage dirty trees, branch drift, Docker health and recent work from one workspace view."],
  ["Work in the right boundary", "Open Git, branches, a terminal and Compose controls already scoped to one repository."],
  ["Resume your agent context", "Search local Codex, Claude Code and Gemini CLI sessions without sending their history anywhere."],
];

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

      <Container maxWidth="lg" component="main" sx={{ pt: { xs: 8, md: 13 }, pb: { xs: 8, md: 12 } }}>
        <Stack spacing={4} alignItems="flex-start" sx={{ maxWidth: 780 }}>
          <Chip icon={<TerminalRounded />} label="Local-first command center" sx={{ bgcolor: "rgba(135, 194, 255, .12)", color: "#b5dcff", border: "1px solid rgba(135, 194, 255, .22)", fontWeight: 600 }} />
          <Typography component="h1" sx={{ fontSize: { xs: "3.1rem", sm: "4.5rem", md: "5.65rem" }, lineHeight: .98, letterSpacing: "-.065em", fontWeight: 750, maxWidth: 760 }}>
            Your repositories, finally in one clear view.
          </Typography>
          <Typography sx={{ maxWidth: 620, fontSize: { xs: "1.08rem", md: "1.25rem" }, lineHeight: 1.65, color: "#b7c0d4" }}>
            repo-control shows what is clean, drifting or blocked across your local workspace—then gives you the safe next action without losing context.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
            <Button href="#/demo" variant="contained" endIcon={<PlayArrowRounded />} size="large" sx={{ px: 2.5, py: 1.35, bgcolor: "#8ec8ff", color: "#08111f", fontWeight: 700, textTransform: "none", "&:hover": { bgcolor: "#b5dcff" } }}>
              Explore the interactive demo
            </Button>
            <Button href="https://github.com/LorenzoVicino/repo-control#try-it-in-one-command" target="_blank" rel="noreferrer" variant="outlined" endIcon={<ArrowForwardRounded />} size="large" sx={{ px: 2.5, py: 1.35, borderColor: "rgba(255,255,255,.24)", color: "#f3f6fb", fontWeight: 600, textTransform: "none" }}>
              Install locally
            </Button>
          </Stack>
          <Typography variant="body2" sx={{ color: "#8490aa", fontFamily: "var(--rc-font-mono)", fontSize: 12 }}>npx repo-control ~/projects</Typography>
        </Stack>

        <Box sx={{ mt: { xs: 9, md: 13 }, borderTop: "1px solid rgba(255,255,255,.14)", borderBottom: "1px solid rgba(255,255,255,.14)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
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
            <Typography variant="h5" fontWeight={700} gutterBottom>Made for the work that starts after “git status”.</Typography>
            <Typography sx={{ color: "#aeb8cb" }}>No cloud workspace, no vanity dashboard—just your machine, your repositories and your tools.</Typography>
          </Box>
          <Button href="#/demo" variant="text" color="inherit" endIcon={<ArrowForwardRounded />} sx={{ flexShrink: 0, fontWeight: 700, textTransform: "none" }}>Open demo</Button>
        </Box>
      </Container>
    </Box>
  );
}
