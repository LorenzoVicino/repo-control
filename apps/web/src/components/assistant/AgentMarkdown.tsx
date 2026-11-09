import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import * as React from "react";
import { MONO_FONT_FAMILY } from "../../theme";
import { parseMarkdown } from "./markdown";

// Renders the agent's Markdown (see markdown.ts) plus inline code, bold and italics. It
// builds React elements directly; no HTML from the model is ever interpreted.

/** Inline code, **bold** and *italic* or _italic_, in that order of precedence. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${match.index}-${token.length}`;
    if (match[1]) {
      nodes.push(
        <Box
          key={key}
          component="code"
          sx={(theme) => ({
            fontFamily: MONO_FONT_FAMILY,
            fontSize: "0.88em",
            px: 0.6,
            py: 0.1,
            borderRadius: 0.75,
            bgcolor: alpha(theme.palette.text.primary, 0.08)
          })}
        >
          {token.slice(1, -1)}
        </Box>
      );
    } else if (match[2]) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function AgentMarkdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseMarkdown(text), [text]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, fontSize: "0.98rem", lineHeight: 1.6, color: "text.primary", minWidth: 0 }}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <Typography key={index} component="p" sx={{ fontWeight: 600, fontSize: "1rem", mt: index ? 0.5 : 0 }}>
                {renderInline(block.text)}
              </Typography>
            );
          case "list": {
            const List = block.ordered ? "ol" : "ul";
            return (
              <Box key={index} component={List} sx={{ m: 0, pl: 2.75, display: "flex", flexDirection: "column", gap: 0.5 }}>
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInline(item)}</li>
                ))}
              </Box>
            );
          }
          case "code":
            return (
              <Box
                key={index}
                component="pre"
                sx={(theme) => ({
                  m: 0,
                  p: 1.5,
                  overflowX: "auto",
                  borderRadius: 1.5,
                  fontFamily: MONO_FONT_FAMILY,
                  fontSize: "0.82rem",
                  lineHeight: 1.55,
                  bgcolor: alpha(theme.palette.background.default, 0.6),
                  border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`
                })}
              >
                {block.text}
              </Box>
            );
          case "table":
            return (
              <Box key={index} sx={{ overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={(theme) => ({
                    borderCollapse: "collapse",
                    fontSize: "0.88rem",
                    "& th, & td": { textAlign: "left", py: 0.75, pr: 2, borderBottom: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`, verticalAlign: "top" },
                    "& th": { fontWeight: 600, color: "text.secondary" }
                  })}
                >
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex}>{renderInline(cell)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{renderInline(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            );
          default:
            return (
              <Typography key={index} component="p" sx={{ m: 0, fontSize: "inherit", lineHeight: "inherit" }}>
                {renderInline(block.text)}
              </Typography>
            );
        }
      })}
    </Box>
  );
}
