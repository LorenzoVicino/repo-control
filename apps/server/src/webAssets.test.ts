import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Fastify from "fastify";
import { appRootPath, hasBuiltWebAssets, webDistPath } from "./lib/appPaths.js";
import { registerWebAssets } from "./webAssets.js";

async function createAssetFixture(): Promise<string> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-web-assets-"));

  await fs.writeFile(path.join(rootPath, "index.html"), "<!doctype html><title>fixture</title>", "utf8");
  await fs.mkdir(path.join(rootPath, "assets"));
  await fs.writeFile(path.join(rootPath, "assets", "app.js"), "export default 1;\n", "utf8");
  await fs.writeFile(path.join(rootPath, "llms.txt"), "# fixture\n", "utf8");

  return rootPath;
}

test("serves the built dashboard and routes unmatched GETs back to the app shell", async (t) => {
  const rootPath = await createAssetFixture();
  const app = Fastify();

  app.get("/api/health", async () => ({ ok: true }));
  await registerWebAssets(app, rootPath);

  t.after(async () => {
    await app.close();
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  const rootResponse = await app.inject({ method: "GET", url: "/" });
  assert.equal(rootResponse.statusCode, 200);
  assert.match(String(rootResponse.headers["content-type"]), /text\/html/);

  const assetResponse = await app.inject({ method: "GET", url: "/assets/app.js" });
  assert.equal(assetResponse.statusCode, 200);
  assert.equal(assetResponse.body, "export default 1;\n");

  // A deep link is a client-side route: the server has no such file and must still answer
  // with the app shell, otherwise a refresh on any page inside the dashboard 404s.
  const deepLinkResponse = await app.inject({ method: "GET", url: "/projects/example/branches" });
  assert.equal(deepLinkResponse.statusCode, 200);
  assert.match(String(deepLinkResponse.headers["content-type"]), /text\/html/);

  // A text file at the root has to be served as text. The single-page fallback answers
  // every unmatched GET with index.html, so a missing llms.txt would return the app shell
  // with a 200 - which reads to a crawler as a malformed llms.txt rather than an absent one.
  const llmsResponse = await app.inject({ method: "GET", url: "/llms.txt" });
  assert.equal(llmsResponse.statusCode, 200);
  assert.match(String(llmsResponse.headers["content-type"]), /text\/plain/);
  assert.equal(llmsResponse.body, "# fixture\n");

  // The asset wildcard must never shadow a registered API route.
  const apiResponse = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(apiResponse.statusCode, 200);
  assert.deepEqual(apiResponse.json(), { ok: true });

  // A mistyped endpoint has to stay a JSON 404 rather than silently returning the page,
  // which would turn an API bug into an unparseable response in the client.
  const missingApiResponse = await app.inject({ method: "GET", url: "/api/missing" });
  assert.equal(missingApiResponse.statusCode, 404);
  assert.equal(missingApiResponse.json().code, "NOT_FOUND");

  const missingWriteResponse = await app.inject({ method: "POST", url: "/not-a-page" });
  assert.equal(missingWriteResponse.statusCode, 404);
  assert.equal(missingWriteResponse.json().code, "NOT_FOUND");
});

// Guards the regression that packaging introduces: resolving repo-control's own directory
// from process.cwd() points at the user's workspace when started through npx, which is
// what the self-updater would then run git pull and npm install against.
test("resolves the application root from the module location, not the working directory", async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(appRootPath, "package.json"), "utf8")
  ) as { name?: string };

  assert.equal(packageJson.name, "repo-control");
  assert.equal(webDistPath, path.join(appRootPath, "apps", "web", "dist"));
  assert.equal(hasBuiltWebAssets(), await pathExists(path.join(webDistPath, "index.html")));
});

// The file ships from apps/web/public, which Vite copies to the served root, so its
// format is only ever checked here.
test("ships an llms.txt that follows the format specification", async () => {
  const llmsPath = path.join(appRootPath, "apps", "web", "public", "llms.txt");
  const content = await fs.readFile(llmsPath, "utf8");
  const lines = content.split("\n");

  // Required: an H1 naming the project, first.
  assert.equal(lines[0], "# repo-control");

  // Recommended: a blockquote summary carrying what is needed to read the rest.
  const summary = lines.find((line) => line.startsWith(">"));
  assert.ok(summary, "llms.txt needs a blockquote summary");
  assert.ok(summary.length > 80, "the summary should actually describe the project");

  // File lists are H2-delimited, and every entry is a markdown link.
  const sections = lines.filter((line) => line.startsWith("## "));
  assert.deepEqual(sections, ["## Documentation", "## Optional"]);

  const entries = lines.filter((line) => line.startsWith("- "));
  assert.ok(entries.length >= 4);
  for (const entry of entries) {
    assert.match(entry, /^- \[[^\]]+\]\(https:\/\/[^)]+\)(: .+)?$/, `malformed entry: ${entry}`);
  }

  // Only H1 and H2 belong in the file; a deeper heading breaks the file-list parse.
  assert.equal(lines.filter((line) => /^#{3,}\s/.test(line)).length, 0);
});

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
