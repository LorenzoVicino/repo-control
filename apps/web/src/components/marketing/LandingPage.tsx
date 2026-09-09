import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import GitHub from "@mui/icons-material/GitHub";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import TerminalRounded from "@mui/icons-material/TerminalRounded";
import { Box, Button, Container, Stack, Typography } from "@mui/material";

const githubUrl = "https://github.com/LorenzoVicino/repo-control";
const installUrl = `${githubUrl}#try-it-in-one-command`;
const stories = [
  ["See", "Dirty trees, branch drift, containers and recent work across the entire workspace."],
  ["Decide", "Know which repository needs attention and understand its state before taking action."],
  ["Act", "Open Git, branches, a scoped terminal or Compose controls without reconstructing context."],
  ["Resume", "Find local Codex, Claude Code and Gemini CLI sessions by repository and continue in a native terminal."],
];

function Mark() {
  return <Box component="img" src={`${import.meta.env.BASE_URL}icon/repo-control-icon.svg`} alt="" sx={{ width: 34, height: 34 }} />;
}

const cinematicReveal = {
  "@media (prefers-reduced-motion: no-preference)": {
    animation: "rcCinematicIn linear both",
    animationTimeline: "view()",
    animationRange: "entry 5% cover 34%",
  },
};

export function LandingPage() {
  const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
  return (
    <Box sx={{
      "--rc-night": "#0b0e14", "--rc-panel": "#121722", "--rc-ink": "#eef2f8", "--rc-muted": "#9ba6b8", "--rc-line": "rgba(238,242,248,.15)", "--rc-accent": "#66a7ff",
      "@keyframes rcHeroIn": { from: { opacity: 0, transform: "translateY(28px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      "@keyframes rcCinematicIn": { from: { opacity: .18, transform: "translateY(70px) scale(.98)" }, to: { opacity: 1, transform: "translateY(0) scale(1)" } },
      minHeight: "100dvh", bgcolor: "var(--rc-night)", color: "var(--rc-ink)", overflow: "hidden",
    }}>
      <Box component="header" sx={{ position: "absolute", inset: "0 0 auto", zIndex: 2, borderBottom: "1px solid rgba(255,255,255,.14)", bgcolor: "rgba(11,14,20,.45)", backdropFilter: "blur(14px)" }}>
        <Container maxWidth="lg" sx={{ minHeight: 70, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.2}><Mark /><Typography fontWeight={760} letterSpacing="-.035em">repo-control</Typography></Stack>
          <Stack component="nav" aria-label="Main navigation" direction="row" alignItems="center" spacing={{ xs: 0, sm: 1 }}>
            <Button href="#product" color="inherit" sx={{ display: { xs: "none", sm: "inline-flex" }, textTransform: "none" }}>Product</Button>
            <Button href={githubUrl} target="_blank" rel="noreferrer" color="inherit" startIcon={<GitHub />} sx={{ textTransform: "none" }}>GitHub</Button>
          </Stack>
        </Container>
      </Box>

      <Box component="main">
        <Box component="section" sx={{ minHeight: "100dvh", position: "relative", display: "grid", alignItems: "end", isolation: "isolate" }}>
          <Box component="video" autoPlay muted loop playsInline preload="auto" poster={asset("marketing/repo-control-demo-poster.png")} aria-label="repo-control navigating a sample multi-repository workspace" sx={{ position: "absolute", inset: 0, zIndex: -2, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}>
            <source src={asset("marketing/repo-control-demo.webm")} type="video/webm" />
          </Box>
          <Box sx={{ position: "absolute", inset: 0, zIndex: -1, background: "linear-gradient(180deg, rgba(7,9,14,.34) 0%, rgba(7,9,14,.22) 30%, rgba(7,9,14,.94) 88%, #0b0e14 100%)" }} />
          <Container maxWidth="lg" sx={{ pb: { xs: 7, md: 9 }, pt: 14 }}>
            <Box sx={{ maxWidth: 960, animation: "rcHeroIn .9s cubic-bezier(.16,1,.3,1) both", "@media (prefers-reduced-motion: reduce)": { animation: "none" } }}>
              <Typography sx={{ mb: 2, color: "#9bc6ff", fontFamily: "var(--rc-font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".11em", textTransform: "uppercase" }}>Local-first workspace control</Typography>
              <Typography component="h1" sx={{ fontSize: { xs: "3.5rem", sm: "5.4rem", lg: "7rem" }, lineHeight: .88, letterSpacing: "-.07em", fontWeight: 760, textShadow: "0 4px 32px rgba(0,0,0,.55)" }}>Every repo.<br />Under control.</Typography>
              <Box sx={{ mt: { xs: 3, md: 4 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "6fr 6fr" }, gap: 3, alignItems: "end" }}>
                <Typography sx={{ maxWidth: 520, color: "#d0d7e2", fontSize: { xs: 17, md: 20 }, lineHeight: 1.5 }}>See what needs attention. Take the next safe action. Stay on your machine.</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} justifyContent={{ md: "flex-end" }}>
                  <Button href="#/demo" variant="contained" endIcon={<PlayArrowRounded />} sx={{ minHeight: 50, px: 2.7, whiteSpace: "nowrap", bgcolor: "var(--rc-accent)", color: "#0a1422", borderRadius: "10px", textTransform: "none", fontWeight: 800, boxShadow: "none", transition: "transform .2s ease", "&:hover": { bgcolor: "#8cbdff", boxShadow: "none", transform: "translateY(-2px)" }, "&:active": { transform: "translateY(1px)" } }}>Try demo</Button>
                  <Button href={installUrl} target="_blank" rel="noreferrer" variant="outlined" endIcon={<ArrowForwardRounded />} sx={{ minHeight: 50, px: 2.7, whiteSpace: "nowrap", color: "#f0f3f8", borderColor: "rgba(255,255,255,.42)", borderRadius: "10px", textTransform: "none", fontWeight: 700, bgcolor: "rgba(11,14,20,.32)" }}>Install</Button>
                </Stack>
              </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" sx={{ minHeight: { md: "90dvh" }, py: { xs: 12, md: 18 }, display: "grid", alignItems: "center" }}>
            <Typography component="h2" sx={{ ...cinematicReveal, maxWidth: 1080, fontSize: { xs: "2.8rem", sm: "4.6rem", lg: "6.3rem" }, lineHeight: .94, letterSpacing: "-.065em", fontWeight: 730 }}>You do not have too many repositories. You have too many disconnected views.</Typography>
          </Box>

          <Box id="product" component="section" sx={{ pb: { xs: 12, md: 20 } }}>
            {stories.map(([title, body], index) => (
              <Box key={title} sx={{ ...cinematicReveal, minHeight: { xs: 280, md: 350 }, py: { xs: 5, md: 7 }, borderTop: "1px solid var(--rc-line)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "5fr 7fr" }, gap: { xs: 3, md: 8 }, alignItems: "center" }}>
                <Typography component="h3" sx={{ color: index === 0 ? "var(--rc-accent)" : "var(--rc-ink)", fontSize: { xs: "3rem", md: "5.5rem" }, lineHeight: .9, letterSpacing: "-.065em", fontWeight: 730 }}>{title}</Typography>
                <Typography sx={{ maxWidth: 620, color: "var(--rc-muted)", fontSize: { xs: 19, md: 25 }, lineHeight: 1.45 }}>{body}</Typography>
              </Box>
            ))}
          </Box>
        </Container>

        <Box component="section" sx={{ minHeight: "100dvh", display: "grid", alignItems: "center", backgroundImage: `linear-gradient(90deg, rgba(8,11,16,.94) 0%, rgba(8,11,16,.69) 58%, rgba(8,11,16,.38) 100%), url(${asset("marketing/operator-workbench.png")})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <Container maxWidth="lg" sx={{ py: { xs: 12, md: 18 } }}>
            <Box sx={{ ...cinematicReveal, maxWidth: 760 }}><Typography component="h2" sx={{ fontSize: { xs: "3rem", md: "6rem" }, lineHeight: .9, letterSpacing: "-.065em", fontWeight: 740 }}>Your machine stays the source of truth.</Typography><Typography sx={{ mt: 4, maxWidth: 600, color: "#c2cad6", fontSize: { xs: 17, md: 21 }, lineHeight: 1.6 }}>Real Git. Real Docker. Your existing agent histories. The API binds to localhost and every operation stays scoped to a discovered repository.</Typography></Box>
          </Container>
        </Box>

        <Container maxWidth="lg">
          <Box component="section" sx={{ minHeight: { md: "85dvh" }, py: { xs: 12, md: 18 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "7fr 5fr" }, gap: { xs: 7, md: 10 }, alignItems: "center" }}>
            <Box sx={cinematicReveal}><Typography component="h2" sx={{ fontSize: { xs: "3rem", md: "5.6rem" }, lineHeight: .91, letterSpacing: "-.065em", fontWeight: 740 }}>One command.<br />Then clarity.</Typography><Typography sx={{ mt: 3, maxWidth: 530, color: "var(--rc-muted)", fontSize: 18, lineHeight: 1.6 }}>Point repo-control at a folder. It discovers the repositories and opens the workspace in your browser.</Typography></Box>
            <Box sx={{ ...cinematicReveal, p: { xs: 3, md: 4 }, bgcolor: "var(--rc-panel)", border: "1px solid var(--rc-line)", borderRadius: "16px" }}><Stack direction="row" spacing={1.5} alignItems="center"><TerminalRounded sx={{ color: "var(--rc-accent)" }} /><Typography component="code" sx={{ fontFamily: "var(--rc-font-mono)", fontSize: { xs: 14, sm: 18 }, color: "#eef2f8" }}>npx repo-control ~/projects</Typography></Stack></Box>
          </Box>

          <Box component="section" sx={{ ...cinematicReveal, mb: { xs: 8, md: 12 }, py: { xs: 9, md: 13 }, borderTop: "1px solid var(--rc-line)", display: "grid", gridTemplateColumns: { xs: "1fr", md: "8fr 4fr" }, gap: 5, alignItems: "end" }}>
            <Box><Typography component="h2" sx={{ maxWidth: 780, fontSize: { xs: "3.15rem", md: "6rem" }, lineHeight: .9, letterSpacing: "-.065em", fontWeight: 750 }}>Open the demo. See where your next action lives.</Typography><Typography sx={{ mt: 3, maxWidth: 590, color: "var(--rc-muted)", fontSize: 18, lineHeight: 1.6 }}>The sample workspace runs entirely in your browser. Explore it, then bring the same control to your own repositories.</Typography></Box>
            <Stack spacing={1.25}><Button href="#/demo" variant="contained" endIcon={<PlayArrowRounded />} sx={{ minHeight: 52, whiteSpace: "nowrap", bgcolor: "var(--rc-accent)", color: "#0a1422", borderRadius: "10px", textTransform: "none", fontWeight: 800, boxShadow: "none", "&:hover": { bgcolor: "#8cbdff", boxShadow: "none" } }}>Try demo</Button><Button href={githubUrl} target="_blank" rel="noreferrer" color="inherit" endIcon={<GitHub />} sx={{ minHeight: 48, whiteSpace: "nowrap", borderRadius: "10px", textTransform: "none", fontWeight: 700 }}>View source</Button></Stack>
          </Box>
        </Container>
      </Box>

      <Box component="footer" sx={{ borderTop: "1px solid var(--rc-line)" }}><Container maxWidth="lg" sx={{ py: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}><Stack direction="row" alignItems="center" spacing={1}><Mark /><Typography fontWeight={750}>repo-control</Typography></Stack><Typography sx={{ color: "var(--rc-muted)", fontSize: 13 }}>Open source. Local-first. Built for multi-repository work.</Typography></Container></Box>
    </Box>
  );
}
