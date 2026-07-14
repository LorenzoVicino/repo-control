import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { alpha, Box, Chip, CircularProgress, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import React from "react";
import { fetchRandomDashboardQuote } from "../../api/quotes";
import type { DashboardQuote } from "../../types/quotes";
import type { DashboardSection } from "./DashboardSidebar";
import { DashboardQuickActions } from "./DashboardQuickActions";

type DashboardHomeProps = {
  onNavigate: (section: DashboardSection) => void;
};

type Quote = {
  text: string;
  author: string;
  source: "local" | DashboardQuote["source"];
};

const LAST_QUOTE_STORAGE_KEY = "repo-control-last-dashboard-quote";
const QUOTES: Quote[] = [
  {
    text: "We can only see a short distance ahead, but we can see plenty there that needs to be done.",
    author: "Alan Turing",
    source: "local"
  },
  {
    text: "The Analytical Engine has no pretensions whatever to originate anything.",
    author: "Ada Lovelace",
    source: "local"
  },
  {
    text: "Testing shows the presence, not the absence of bugs.",
    author: "Edsger W. Dijkstra",
    source: "local"
  },
  {
    text: "Premature optimization is the root of all evil.",
    author: "Donald Knuth",
    source: "local"
  },
  {
    text: "What I cannot create, I do not understand.",
    author: "Richard Feynman",
    source: "local"
  },
  {
    text: "The purpose of computing is insight, not numbers.",
    author: "Richard Hamming",
    source: "local"
  },
  {
    text: "A distributed system is one in which the failure of a computer you didn't even know existed can render your own computer unusable.",
    author: "Leslie Lamport",
    source: "local"
  },
  {
    text: "The Web should be a medium for communication between people: communication through shared knowledge.",
    author: "Tim Berners-Lee",
    source: "local"
  },
  {
    text: "The best way to predict the future is to invent it.",
    author: "Alan Kay",
    source: "local"
  },
  {
    text: "There are only two kinds of languages: the ones people complain about and the ones nobody uses.",
    author: "Bjarne Stroustrup",
    source: "local"
  },
  {
    text: "Everyone knows that debugging is twice as hard as writing a program in the first place.",
    author: "Brian Kernighan",
    source: "local"
  },
  {
    text: "The bearing of a child takes nine months, no matter how many women are assigned.",
    author: "Fred Brooks",
    source: "local"
  },
  {
    text: "Talk is cheap. Show me the code.",
    author: "Linus Torvalds",
    source: "local"
  },
  {
    text: "There was no choice but to be pioneers; no time to be beginners.",
    author: "Margaret Hamilton",
    source: "local"
  },
  {
    text: "A language that doesn't affect the way you think about programming is not worth knowing.",
    author: "Alan Perlis",
    source: "local"
  },
  {
    text: "You don't understand anything until you learn it more than one way.",
    author: "Marvin Minsky",
    source: "local"
  },
  {
    text: "Nothing in life is to be feared; it is only to be understood.",
    author: "Marie Curie",
    source: "local"
  },
  {
    text: "If I have seen further, it is by standing on the shoulders of giants.",
    author: "Isaac Newton",
    source: "local"
  },
  {
    text: "Chance favors the prepared mind.",
    author: "Louis Pasteur",
    source: "local"
  },
  {
    text: "There are two ways of constructing a software design. One way is to make it so simple that there are obviously no deficiencies.",
    author: "C. A. R. Hoare",
    source: "local"
  }
];

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const [quote, setQuote] = React.useState<Quote>(pickLocalQuote);
  const [isLoadingQuote, setIsLoadingQuote] = React.useState(true);

  React.useEffect(() => {
    window.localStorage.setItem(LAST_QUOTE_STORAGE_KEY, quote.text);
  }, [quote.text]);

  React.useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    void fetchRandomDashboardQuote(controller.signal)
      .then((response) => {
        const apiQuote = response.quote;

        if (isActive && apiQuote) {
          setQuote((currentQuote) => toNextQuote(apiQuote, currentQuote));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setIsLoadingQuote(false);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  async function showAnotherQuote() {
    if (isLoadingQuote) {
      return;
    }

    setIsLoadingQuote(true);

    try {
      const response = await fetchRandomDashboardQuote();
      setQuote((currentQuote) =>
        response.quote ? toNextQuote(response.quote, currentQuote) : pickLocalQuote(currentQuote.text)
      );
    } catch {
      setQuote((currentQuote) => pickLocalQuote(currentQuote.text));
    } finally {
      setIsLoadingQuote(false);
    }
  }

  return (
    <Stack
      spacing={{ xs: 2.5, md: 3 }}
      sx={{
        minHeight: { xs: "auto", md: "calc(100dvh - 116px)" }
      }}
    >
      <Box
        component="figure"
        sx={{
          position: "relative",
          m: 0,
          minHeight: { xs: 220, md: 270 },
          flexGrow: { md: 1 },
          display: "flex",
          alignItems: "stretch",
          px: { xs: 2, sm: 3.5, md: 5 },
          py: { xs: 4, md: 5 },
          overflow: "hidden",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === "light" ? 0.035 : 0.07)
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: "0 auto 0 0",
            width: 4,
            bgcolor: "primary.main"
          }}
        />
        <Stack sx={{ width: "100%", maxWidth: 1080 }}>
          <Stack direction="row" alignItems="center">
            <Chip size="small" variant="outlined" color="primary" label="Dashboard" />
            <Tooltip title="Mostra un'altra citazione">
              <span>
                <IconButton
                  size="small"
                  onClick={showAnotherQuote}
                  disabled={isLoadingQuote}
                  aria-label="Mostra un'altra citazione"
                  aria-busy={isLoadingQuote}
                  sx={{ position: "absolute", top: { xs: 24, md: 32 }, right: { xs: 20, md: 32 } }}
                >
                  {isLoadingQuote ? <CircularProgress size={17} color="inherit" /> : <ArrowForwardRoundedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
          <Stack spacing={2} justifyContent="center" sx={{ flexGrow: 1, py: { xs: 3, md: 4 } }}>
            <Typography
              component="blockquote"
              sx={{
                m: 0,
                maxWidth: 1000,
                fontSize: { xs: "1.45rem", md: "2rem" },
                lineHeight: 1.25,
                fontWeight: 650,
                color: "text.primary"
              }}
            >
              “{quote.text}”
            </Typography>
            <Typography component="figcaption" variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              — {quote.author}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <DashboardQuickActions onNavigate={onNavigate} />
    </Stack>
  );
}

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

function toNextQuote(apiQuote: DashboardQuote, currentQuote: Quote): Quote {
  if (apiQuote.text === currentQuote.text) {
    return pickLocalQuote(currentQuote.text);
  }

  return {
    text: apiQuote.text,
    author: apiQuote.author,
    source: apiQuote.source
  };
}
