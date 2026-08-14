import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDockerComposePs,
  readDockerComposeProject,
  readRunningDockerContainers,
  stopDockerContainers
} from "./docker.js";

function commandResult(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    command: "docker ps",
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "",
    durationMs: 1,
    ...overrides
  };
}

test("reads, parses, groups and sorts Docker containers", async () => {
  const calls: unknown[][] = [];
  const stdout = [
    "standalone\tredis-one\tredis:7\tUp 2 hours\t6379/tcp\t2 hours\tcustom-label",
    "web-id\tacme-web-1\tapp:web\tUp 1 minute\t0.0.0.0:3000->3000/tcp\t1 minute\tcom.docker.compose.project=acme,com.docker.compose.service=web,com.docker.compose.project.working_dir=/workspace/acme",
    "api-id\tacme-api-1\tapp:api\tUp 1 minute\t3001/tcp\t1 minute\tcom.docker.compose.project=acme,com.docker.compose.service=api,com.docker.compose.project.working_dir=/workspace/acme",
    "other-id\tzeta-worker\tworker:latest\tUp\t\tnow\tcom.docker.compose.project=zeta,com.docker.compose.service=worker",
    "missing-name\t\timage\tUp\t\tnow\t",
    ""
  ].join("\n");
  const runCommand = async (...args: unknown[]) => {
    calls.push(args);
    return commandResult({ stdout });
  };

  const response = await readRunningDockerContainers("/workspace", runCommand);
  assert.equal(response.ok, true);
  assert.equal(response.error, null);
  assert.equal(response.containers.length, 4);
  assert.equal(response.groups.length, 3);
  assert.equal(response.groups[0]?.name, "acme");
  assert.deepEqual(response.groups[0]?.containers.map((container) => container.composeService), ["api", "web"]);
  assert.equal(response.groups[1]?.name, "zeta");
  assert.equal(response.groups[2]?.name, "redis-one");
  assert.equal(response.groups[2]?.id, "container:standalone");
  assert.equal(response.containers[0]?.composeProject, null);
  const call = calls[0]!;
  assert.equal(call[0], "/workspace");
  assert.equal(call[1], "docker");
  assert.deepEqual((call[2] as string[]).slice(0, 2), ["ps", "--format"]);
  assert.match((call[2] as string[])[2]!, /\{\{\.ID\}\}/);
  assert.equal(call[3], 20_000);
});

test("returns actionable Docker availability errors", async (context) => {
  const cases = [
    ["spawn docker ENOENT", "Docker non trovato nel PATH del processo Node."],
    ["docker: command not found", "Docker non trovato nel PATH del processo Node."],
    ["Cannot connect to the Docker daemon", "Docker non e' avviato o il daemon non e' raggiungibile."],
    ["Docker Desktop is stopped", "Docker non e' avviato o il daemon non e' raggiungibile."],
    ["permission denied\nmore details", "permission denied"],
    ["", "Impossibile leggere i container Docker."]
  ] as const;

  for (const [output, expected] of cases) {
    await context.test(output || "empty error", async () => {
      const response = await readRunningDockerContainers("/workspace", async () =>
        commandResult({ ok: false, exitCode: 1, output, stderr: output })
      );
      assert.equal(response.ok, false);
      assert.deepEqual(response.containers, []);
      assert.deepEqual(response.groups, []);
      assert.equal(response.error, expected);
      assert.match(response.checkedAt, /^\d{4}-\d{2}-\d{2}T/);
    });
  }
});

test("stops the selected Docker containers with the long action timeout", async () => {
  const calls: unknown[][] = [];
  const expected = commandResult({ command: "docker stop one two" });
  const actual = await stopDockerContainers("/workspace", ["one", "two"], async (...args: unknown[]) => {
    calls.push(args);
    return expected;
  });

  assert.equal(actual, expected);
  assert.deepEqual(calls, [["/workspace", "docker", ["stop", "one", "two"], 300_000]]);
});

test("reads configured Compose services including stopped containers, health and published ports", async () => {
  const psRows = [
    JSON.stringify({
      ID: "web-id",
      Name: "acme-web-1",
      Image: "app:web",
      Project: "acme",
      Service: "web",
      State: "running",
      Status: "Up 2 minutes (healthy)",
      Health: "healthy",
      RunningFor: "2 minutes",
      Publishers: [{ URL: "0.0.0.0", TargetPort: 3000, PublishedPort: 5173, Protocol: "tcp" }]
    }),
    JSON.stringify({
      ID: "db-id",
      Name: "acme-db-1",
      Image: "postgres:17",
      Project: "acme",
      Service: "db",
      State: "exited",
      Status: "Exited (0)",
      Publishers: [{ TargetPort: 5432, PublishedPort: 0, Protocol: "tcp" }]
    })
  ].join("\n");
  const calls: unknown[][] = [];
  const response = await readDockerComposeProject("C:\\workspace\\acme", async (...args: unknown[]) => {
    calls.push(args);
    const commandArgs = args[2] as string[];
    return commandArgs.includes("config")
      ? commandResult({ stdout: "web\ndb\nworker\n" })
      : commandResult({ stdout: psRows });
  });

  assert.equal(response.ok, true);
  assert.equal(response.name, "acme");
  assert.deepEqual(response.services.map((service) => service.name), ["db", "web", "worker"]);
  assert.equal(response.services.find((service) => service.name === "worker")?.status, "Not created");
  assert.equal(response.services.find((service) => service.name === "web")?.health, "healthy");
  assert.equal(response.services.find((service) => service.name === "web")?.ports[0]?.url, "http://127.0.0.1:5173");
  assert.deepEqual((calls[1]?.[2] as string[]).slice(0, 3), ["compose", "ps", "--all"]);
});

test("parses Compose JSON arrays and returns project-specific failures", async () => {
  const services = parseDockerComposePs(JSON.stringify([{
    ID: "api-id",
    Name: "demo-api-1",
    Image: "demo:api",
    Service: "api",
    State: "running",
    Status: "Up (unhealthy)",
    Publishers: [{ URL: "::1", TargetPort: "8080", PublishedPort: "8080", Protocol: "tcp" }]
  }]));
  assert.equal(services[0]?.health, "unhealthy");
  assert.equal(services[0]?.ports[0]?.url, "http://[::1]:8080");

  const response = await readDockerComposeProject("/workspace/demo", async (_cwd, _command, args) =>
    args.includes("config")
      ? commandResult({ ok: false, exitCode: 1, output: "permission denied" })
      : commandResult()
  );
  assert.equal(response.ok, false);
  assert.equal(response.error, "permission denied");
  assert.deepEqual(response.services, []);
});
