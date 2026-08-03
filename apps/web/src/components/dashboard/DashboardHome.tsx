import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import { alpha, Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import React from "react";
import type { DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";
import { buildDashboardSnapshot } from "./dashboardInsights";
import { DashboardInsights } from "./DashboardInsights";
import { DashboardMetrics } from "./DashboardMetrics";
import type { DashboardSection } from "./DashboardSidebar";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardRecentActivity } from "./DashboardRecentActivity";

type DashboardHomeProps = {
  projects: ProjectSummary[];
  favoriteProjectIds: string[];
  dockerStatus: DockerContainersResponse | undefined;
  onNavigate: (section: DashboardSection) => void;
  onOpenProject: (projectId: string) => void;
};

type Quote = {
  text: string;
  author: string;
};

const LAST_QUOTE_STORAGE_KEY = "repo-control-last-dashboard-quote";
const QUOTES: Quote[] = [
  {
    text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
    author: "Alan Turing"
  },
  {
    text: "The Analytical Engine has no pretensions whatever to originate anything.",
    author: "Ada Lovelace"
  },
  {
    text: "Testing shows the presence, not the absence of bugs.",
    author: "Edsger W. Dijkstra"
  },
  {
    text: "Premature optimization is the root of all evil.",
    author: "Donald Knuth"
  },
  {
    text: "What I cannot create, I do not understand.",
    author: "Richard Feynman"
  },
  {
    text: "The purpose of computing is insight, not numbers.",
    author: "Richard Hamming"
  },
  {
    text: "A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.",
    author: "Leslie Lamport"
  },
  {
    text: "The Web should be a medium for communication between people: communication through shared knowledge.",
    author: "Tim Berners-Lee"
  },
  {
    text: "The best way to predict the future is to invent it.",
    author: "Alan Kay"
  },
  {
    text: "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    author: "Bjarne Stroustrup"
  },
  {
    text: "Everyone knows that debugging is twice as hard as writing a program in the first place.",
    author: "Brian Kernighan"
  },
  {
    text: "The bearing of a child takes nine months, no matter how many women are assigned.",
    author: "Fred Brooks"
  },
  {
    text: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds"
  },
  {
    text: "There was no choice but to be pioneers; no time to be beginners.",
    author: "Margaret Hamilton"
  },
  {
    text: "A language that doesn't affect the way you think about programming is not worth knowing.",
    author: "Alan Perlis"
  },
  {
    text: "You don't understand anything until you learn it more than one way.",
    author: "Marvin Minsky"
  },
  {
    text: "Nothing in life is to be feared; it is only to be understood.",
    author: "Marie Curie"
  },
  {
    text: "If I have seen further, it is by standing on the shoulders of giants.",
    author: "Isaac Newton"
  },
  {
    text: "Chance favors the prepared mind.",
    author: "Louis Pasteur"
  },
  {
    text: "There are two ways of constructing a software design. One way is to make it so simple that there are obviously no deficiencies.",
    author: "C. A. R. Hoare"
  }
];

export const DashboardHome = React.memo(function DashboardHome({
  projects,
  favoriteProjectIds,
  dockerStatus,
  onNavigate,
  onOpenProject
}: DashboardHomeProps) {
  const [quote, setQuote] = React.useState<Quote>(pickLocalQuote);
  const snapshot = React.useMemo(
    () => buildDashboardSnapshot(projects, favoriteProjectIds, dockerStatus),
    [dockerStatus, favoriteProjectIds, projects]
  );

  React.useEffect(() => {
    window.localStorage.setItem(LAST_QUOTE_STORAGE_KEY, quote.text);
  }, [quote.text]);

  function showAnotherQuote() {
    setQuote((currentQuote) => pickLocalQuote(currentQuote.text));
  }

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: { xs: "auto", md: "calc(100dvh - 116px)" }
      }}
    >
      <Stack spacing={{ xs: 1.5, md: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", xl: "minmax(280px, 0.65fr) minmax(640px, 1.35fr)" },
            gap: { xs: 1.5, xl: 3 },
            alignItems: "end",
            py: { xs: 0.5, md: 1 }
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              Workspace operativo
            </Typography>
            <Typography
              id="dashboard-home-title"
              component="h1"
              variant="h1"
              sx={{ mt: 0.15 }}
            >
              Cosa vuoi fare oggi?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 480 }}>
              {snapshot.total === 0
                ? "Seleziona un workspace per iniziare."
                : `${snapshot.healthy} repository pronti, ${snapshot.total - snapshot.healthy} da controllare.`}
            </Typography>
          </Box>

          <DashboardQuickActions
            dockerAvailable={snapshot.dockerAvailable}
            onNavigate={onNavigate}
          />
        </Box>

        <DashboardMetrics snapshot={snapshot} />

        <DashboardInsights snapshot={snapshot} onOpenProject={onOpenProject} />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.25fr) minmax(320px, 0.75fr)" },
            gap: { xs: 1.5, md: 2 }
          }}
        >
          <DashboardRecentActivity snapshot={snapshot} onNavigate={onNavigate} onOpenProject={onOpenProject} />

          <Paper
            component="figure"
            variant="outlined"
            sx={{
              position: "relative",
              m: 0,
              minWidth: 0,
              minHeight: 194,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              p: { xs: 1.75, sm: 2 },
              overflow: "hidden",
              bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "light" ? 0.96 : 0.9)
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ pr: 4 }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: 17, color: "secondary.main" }} />
              <Typography component="h2" variant="h2">
                Una prospettiva
              </Typography>
            </Stack>

            <Tooltip title="Mostra un'altra citazione">
              <Box
                component="span"
                sx={{ position: "absolute", top: 12, right: 12, display: "inline-flex" }}
              >
                <IconButton
                  size="small"
                  onClick={showAnotherQuote}
                  aria-label="Mostra un'altra citazione"
                >
                  <ArrowForwardRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
            </Tooltip>

            <Typography
              component="blockquote"
              variant="body1"
              sx={{ m: 0, py: 2, fontWeight: 650, lineHeight: 1.5, maxWidth: 640 }}
            >
              “{quote.text}”
            </Typography>
            <Typography component="figcaption" variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
              — {quote.author}
            </Typography>
          </Paper>
        </Box>
      </Stack>

    </Box>
  );
});

function pickLocalQuote(excludedText = window.localStorage.getItem(LAST_QUOTE_STORAGE_KEY) ?? ""): Quote {
  const excludedIndex = QUOTES.findIndex((quote) => quote.text === excludedText);
  return QUOTES[pickRandomIndex(excludedIndex)];
}

function pickRandomIndex(excludedIndex: number): number {
  if (QUOTES.length <= 1) {
    return 0;
  }

  const candidate = Math.floor(Math.random() * (QUOTES.length - 1));
  return candidate >= excludedIndex && excludedIndex >= 0 ? candidate + 1 : candidate;
}
