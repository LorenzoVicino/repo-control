import type { RepositoryDocuments } from "./collect.js";
import type { RepositoryLabel } from "./labels.js";

// Search works on chunks: a synthesized summary of the repository, its README and docs split
// at headings, its manifests and its recent commit subjects. Chunks are small enough that a
// match points at the relevant part, and each one is prefixed with the repository name so a
// keyword search for the name still finds it.

export type ChunkKind = "summary" | "readme" | "doc" | "manifest" | "commits";
export type Chunk = { path: string; kind: ChunkKind; text: string };

const MAX_CHUNK = 1_200;

/** Splits Markdown at headings, then long sections at paragraph breaks. */
export function splitMarkdown(text: string, limit = MAX_CHUNK): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (/^#{1,6}\s/.test(line) && current.join("\n").trim()) {
      sections.push(current.join("\n").trim());
      current = [];
    }
    current.push(line);
  }
  if (current.join("\n").trim()) sections.push(current.join("\n").trim());

  return sections.flatMap((section) => {
    if (section.length <= limit) return [section];
    const pieces: string[] = [];
    let piece = "";
    for (const paragraph of section.split(/\n{2,}/)) {
      if (piece && piece.length + paragraph.length + 2 > limit) {
        pieces.push(piece);
        piece = "";
      }
      // A single paragraph longer than the limit is cut hard; it is rare in READMEs.
      for (let start = 0; start < paragraph.length; start += limit) {
        const slice = paragraph.slice(start, start + limit);
        piece = piece ? `${piece}\n\n${slice}` : slice;
        if (piece.length >= limit) {
          pieces.push(piece);
          piece = "";
        }
      }
    }
    if (piece) pieces.push(piece);
    return pieces;
  });
}

/** One paragraph a person (or an embedding) can read to know what the repository is. */
export function summarize(name: string, docs: RepositoryDocuments, labels: readonly RepositoryLabel[]): string {
  const description = docs.manifests.find((manifest) => manifest.description)?.description;
  const readmeLead = docs.readme
    ? docs.readme.text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.replace(/^#+\s.*$/gm, "").replace(/!\[[^\]]*\]\([^)]*\)|<[^>]+>|\[!\[.*?\]\(.*?\)\]\(.*?\)/g, "").trim())
        .find((paragraph) => paragraph.length > 40)
    : undefined;
  const byKind = (kind: RepositoryLabel["kind"]) => labels.filter((label) => label.kind === kind).map((label) => label.id);
  return [
    `${name}${description ? `: ${description}` : ""}.`,
    readmeLead ? readmeLead.slice(0, 500) : "",
    byKind("kind").length ? `Kind: ${byKind("kind").join(", ")}.` : "",
    byKind("language").length ? `Languages: ${byKind("language").join(", ")}.` : "",
    byKind("framework").length ? `Frameworks: ${byKind("framework").join(", ")}.` : "",
    byKind("topic").length ? `Topics: ${byKind("topic").join(", ")}.` : "",
    byKind("tooling").length ? `Tooling: ${byKind("tooling").join(", ")}.` : "",
    docs.composeServices.length ? `Docker Compose services: ${docs.composeServices.join(", ")}.` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function chunkRepository(name: string, docs: RepositoryDocuments, labels: readonly RepositoryLabel[]): Chunk[] {
  const chunks: Chunk[] = [{ path: "", kind: "summary", text: summarize(name, docs, labels) }];
  const prefix = (text: string) => `${name} · ${text}`;

  if (docs.readme) for (const piece of splitMarkdown(docs.readme.text)) chunks.push({ path: docs.readme.path, kind: "readme", text: prefix(piece) });
  for (const doc of docs.docs) for (const piece of splitMarkdown(doc.text)) chunks.push({ path: doc.path, kind: "doc", text: prefix(piece) });
  for (const manifest of docs.manifests) {
    const lines = [
      manifest.name ? `name: ${manifest.name}` : "",
      manifest.description ? `description: ${manifest.description}` : "",
      manifest.dependencies.length ? `dependencies: ${manifest.dependencies.slice(0, 80).join(", ")}` : "",
      manifest.scripts.length ? `scripts: ${manifest.scripts.join(", ")}` : ""
    ].filter(Boolean);
    if (lines.length) chunks.push({ path: manifest.path, kind: "manifest", text: prefix(lines.join("\n")) });
  }
  if (docs.commits.length) chunks.push({ path: "", kind: "commits", text: prefix(`recent commits:\n${docs.commits.join("\n")}`) });
  return chunks;
}
