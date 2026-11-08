// The subset of Markdown Claude uses in short answers: paragraphs, headings, bullet and
// numbered lists, fenced code and tables. Parsing is kept apart from rendering so it can be
// tested on its own.

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

const LIST_ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) code.push(lines[index++]);
      index += 1;
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", text: heading[1] });
      index += 1;
      continue;
    }

    if (line.includes("|") && TABLE_SEPARATOR.test(lines[index + 1] ?? "")) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) rows.push(splitRow(lines[index++]));
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const item = LIST_ITEM.exec(line);
    if (item) {
      const ordered = item[1] !== undefined;
      const items: string[] = [];
      while (index < lines.length) {
        const match = LIST_ITEM.exec(lines[index]);
        if (match && (match[1] !== undefined) === ordered) {
          items.push(match[2]);
        } else if (lines[index].trim() && /^\s{2,}/.test(lines[index]) && items.length) {
          items[items.length - 1] += ` ${lines[index].trim()}`;
        } else {
          break;
        }
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !LIST_ITEM.test(lines[index]) && !lines[index].trim().startsWith("```") && !/^#{1,6}\s/.test(lines[index])) {
      paragraph.push(lines[index++].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}
