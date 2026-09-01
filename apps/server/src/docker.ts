type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

type CommandRunner = (
  cwd: string,
  command: string,
  args: string[],
  timeoutMs?: number
) => Promise<CommandResult>;

export type DockerContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  runningFor: string;
  composeProject: string | null;
  composeService: string | null;
  composeWorkingDir: string | null;
};

export type DockerContainerGroup = {
  id: string;
  name: string;
  composeProject: string | null;
  workingDir: string | null;
  containers: DockerContainer[];
};

export type DockerContainersResponse = {
  ok: boolean;
  containers: DockerContainer[];
  groups: DockerContainerGroup[];
  checkedAt: string;
  error: string | null;
};

export type DockerContainerStats = {
  id: string;
  name: string;
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
  networkInBytes: number | null;
  networkOutBytes: number | null;
  blockReadBytes: number | null;
  blockWriteBytes: number | null;
  processCount: number | null;
};

export type DockerContainerStatsResponse = {
  ok: boolean;
  stats: DockerContainerStats[];
  checkedAt: string;
  error: string | null;
};

export type DockerComposePort = {
  hostIp: string | null;
  published: number | null;
  target: number;
  protocol: string;
  url: string | null;
};

export type DockerComposeService = {
  name: string;
  containerId: string | null;
  containerName: string | null;
  image: string | null;
  state: string;
  status: string;
  health: string | null;
  runningFor: string | null;
  ports: DockerComposePort[];
};

export type DockerComposeProjectResponse = {
  ok: boolean;
  name: string;
  services: DockerComposeService[];
  checkedAt: string;
  error: string | null;
};

const DOCKER_PS_FORMAT = [
  "{{.ID}}",
  "{{.Names}}",
  "{{.Image}}",
  "{{.Status}}",
  "{{.Ports}}",
  "{{.RunningFor}}",
  "{{.Labels}}"
].join("\t");

export async function readRunningDockerContainers(
  cwd: string,
  runCommand: CommandRunner
): Promise<DockerContainersResponse> {
  const checkedAt = new Date().toISOString();
  const result = await runCommand(cwd, "docker", ["ps", "--format", DOCKER_PS_FORMAT], 1000 * 20);

  if (!result.ok) {
    return {
      ok: false,
      containers: [],
      groups: [],
      checkedAt,
      error: getDockerErrorMessage(result.output || result.stderr || result.stdout)
    };
  }

  const containers = parseDockerPsOutput(result.stdout);

  return {
    ok: true,
    containers,
    groups: groupDockerContainers(containers),
    checkedAt,
    error: null
  };
}

export async function readDockerComposeProject(
  projectPath: string,
  runCommand: CommandRunner
): Promise<DockerComposeProjectResponse> {
  const checkedAt = new Date().toISOString();
  const [servicesResult, psResult] = await Promise.all([
    runCommand(projectPath, "docker", ["compose", "config", "--services"], 20_000),
    runCommand(projectPath, "docker", ["compose", "ps", "--all", "--format", "json"], 20_000)
  ]);

  if (!servicesResult.ok || !psResult.ok) {
    const failure = !servicesResult.ok ? servicesResult : psResult;
    return {
      ok: false,
      name: pathName(projectPath),
      services: [],
      checkedAt,
      error: getDockerErrorMessage(failure.output || failure.stderr || failure.stdout)
    };
  }

  const configuredServices = servicesResult.stdout.split("\n").map((service) => service.trim()).filter(Boolean);
  const containers = parseDockerComposePs(psResult.stdout);
  const containersByService = new Map(containers.map((service) => [service.name, service]));
  const services = [...new Set([...configuredServices, ...containers.map((service) => service.name)])]
    .sort((left, right) => left.localeCompare(right))
    .map((serviceName) => containersByService.get(serviceName) ?? createStoppedComposeService(serviceName));

  return {
    ok: true,
    name: getComposeProjectName(psResult.stdout) ?? pathName(projectPath),
    services,
    checkedAt,
    error: null
  };
}

export function stopDockerContainers(
  cwd: string,
  containerIds: string[],
  runCommand: CommandRunner
): Promise<CommandResult> {
  return runCommand(cwd, "docker", ["stop", ...containerIds], 1000 * 60 * 5);
}

// --no-stream: one sample and exit. `docker stats` without it streams forever, which a
// request/response route cannot consume, and the interface polls anyway.
export async function readDockerContainerStats(
  cwd: string,
  runCommand: CommandRunner
): Promise<DockerContainerStatsResponse> {
  const checkedAt = new Date().toISOString();
  const result = await runCommand(cwd, "docker", ["stats", "--no-stream", "--format", "{{json .}}"], 1000 * 25);

  if (!result.ok) {
    return {
      ok: false,
      stats: [],
      checkedAt,
      error: getDockerErrorMessage(result.output || result.stderr || result.stdout)
    };
  }

  return {
    ok: true,
    stats: parseDockerStatsOutput(result.stdout),
    checkedAt,
    error: null
  };
}

// The boundary for container-scoped actions, and the reason they take an ID rather than a
// name: an exec session may only target a container this daemon currently reports as
// running, exactly as project commands may only target a discovered repository.
export async function findRunningDockerContainer(
  cwd: string,
  containerId: string,
  runCommand: CommandRunner
): Promise<DockerContainer | null> {
  const running = await readRunningDockerContainers(cwd, runCommand);

  if (!running.ok) {
    return null;
  }

  const requestedId = containerId.toLowerCase();

  return (
    running.containers.find((container) => {
      const knownId = container.id.toLowerCase();
      // `docker ps` reports 12 characters; a caller may hold the full 64-character ID.
      return knownId === requestedId || requestedId.startsWith(knownId) || knownId.startsWith(requestedId);
    }) ?? null
  );
}

// Distroless and scratch images have no shell at all, and an exec session that dies
// immediately with "executable file not found" is a worse answer than saying so up front.
export async function resolveContainerShell(
  cwd: string,
  containerId: string,
  runCommand: CommandRunner
): Promise<string | null> {
  const result = await runCommand(
    cwd,
    "docker",
    ["exec", containerId, "sh", "-c", "command -v bash >/dev/null 2>&1 && echo bash || echo sh"],
    1000 * 20
  );

  if (!result.ok) {
    return null;
  }

  const detected = result.stdout.trim().split("\n").pop()?.trim();
  return detected === "bash" || detected === "sh" ? detected : null;
}

function parseDockerStatsOutput(output: string): DockerContainerStats[] {
  return parseComposeJsonRows(output)
    .map((row) => {
      const id = getJsonString(row, "ID") || getJsonString(row, "Container");
      if (!id) return null;

      const [memoryUsedBytes, memoryLimitBytes] = parseByteSizePair(getJsonString(row, "MemUsage"));
      const [networkInBytes, networkOutBytes] = parseByteSizePair(getJsonString(row, "NetIO"));
      const [blockReadBytes, blockWriteBytes] = parseByteSizePair(getJsonString(row, "BlockIO"));

      return {
        id,
        name: getJsonString(row, "Name") || id,
        cpuPercent: parsePercentage(getJsonString(row, "CPUPerc")),
        memoryUsedBytes,
        memoryLimitBytes,
        memoryPercent: parsePercentage(getJsonString(row, "MemPerc")),
        networkInBytes,
        networkOutBytes,
        blockReadBytes,
        blockWriteBytes,
        processCount: parseCount(getJsonString(row, "PIDs"))
      } satisfies DockerContainerStats;
    })
    .filter((stats): stats is DockerContainerStats => stats !== null);
}

function parsePercentage(value: string): number | null {
  const parsed = Number.parseFloat(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCount(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// Docker formats paired measurements as "used / limit": memory in binary units (MiB, GiB),
// network and block I/O in decimal ones (kB, MB). Both spellings appear in the same row.
function parseByteSizePair(value: string): [number | null, number | null] {
  const [left, right] = value.split("/");
  return [parseByteSize(left ?? ""), parseByteSize(right ?? "")];
}

const BYTE_SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1000,
  mb: 1000 ** 2,
  gb: 1000 ** 3,
  tb: 1000 ** 4,
  pb: 1000 ** 5,
  kib: 1024,
  mib: 1024 ** 2,
  gib: 1024 ** 3,
  tib: 1024 ** 4,
  pib: 1024 ** 5
};

export function parseByteSize(value: string): number | null {
  const match = /^\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)\s*$/.exec(value);
  if (!match) return null;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return null;

  const unit = match[2].toLowerCase();
  if (!unit) return Math.round(amount);

  const multiplier = BYTE_SIZE_UNITS[unit];
  return multiplier === undefined ? null : Math.round(amount * multiplier);
}

function parseDockerPsOutput(output: string): DockerContainer[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDockerPsLine)
    .filter((container): container is DockerContainer => container !== null);
}

export function parseDockerComposePs(output: string): DockerComposeService[] {
  return parseComposeJsonRows(output)
    .map((row) => {
      const name = getJsonString(row, "Service");
      if (!name) return null;

      const state = getJsonString(row, "State") || "stopped";
      const status = getJsonString(row, "Status") || state;
      return {
        name,
        containerId: nullableJsonString(row, "ID"),
        containerName: nullableJsonString(row, "Name") ?? nullableJsonString(row, "Names"),
        image: nullableJsonString(row, "Image"),
        state,
        status,
        health: nullableJsonString(row, "Health") ?? parseHealthFromStatus(status),
        runningFor: nullableJsonString(row, "RunningFor"),
        ports: parseComposePublishers(row.Publishers)
      } satisfies DockerComposeService;
    })
    .filter((service): service is DockerComposeService => service !== null);
}

function parseComposeJsonRows(output: string): Array<Record<string, unknown>> {
  const trimmed = output.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
    return isRecord(parsed) ? [parsed] : [];
  } catch {
    return trimmed
      .split("\n")
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as unknown;
          return isRecord(parsed) ? parsed : null;
        } catch {
          return null;
        }
      })
      .filter((row): row is Record<string, unknown> => row !== null);
  }
}

function parseComposePublishers(value: unknown): DockerComposePort[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((publisher) => {
      if (!isRecord(publisher)) return null;
      const target = getJsonNumber(publisher, "TargetPort");
      if (target === null) return null;
      const published = getJsonNumber(publisher, "PublishedPort");
      const hostIp = nullableJsonString(publisher, "URL");
      const protocol = getJsonString(publisher, "Protocol") || "tcp";

      return {
        hostIp,
        published,
        target,
        protocol,
        url: getPublishedPortUrl(hostIp, published, protocol)
      } satisfies DockerComposePort;
    })
    .filter((port): port is DockerComposePort => port !== null);
}

function getPublishedPortUrl(hostIp: string | null, published: number | null, protocol: string): string | null {
  if (!published || protocol.toLowerCase() !== "tcp") return null;
  const host = !hostIp || hostIp === "0.0.0.0" || hostIp === "::" ? "127.0.0.1" : hostIp;
  const wrappedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${wrappedHost}:${published}`;
}

function createStoppedComposeService(name: string): DockerComposeService {
  return {
    name,
    containerId: null,
    containerName: null,
    image: null,
    state: "stopped",
    status: "Not created",
    health: null,
    runningFor: null,
    ports: []
  };
}

function getComposeProjectName(output: string): string | null {
  return parseComposeJsonRows(output).map((row) => nullableJsonString(row, "Project")).find(Boolean) ?? null;
}

function parseHealthFromStatus(status: string): string | null {
  return status.match(/\((healthy|unhealthy|starting)\)/i)?.[1]?.toLowerCase() ?? null;
}

function pathName(projectPath: string): string {
  return projectPath.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || projectPath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getJsonString(value: Record<string, unknown>, key: string): string {
  return typeof value[key] === "string" ? value[key] : "";
}

function nullableJsonString(value: Record<string, unknown>, key: string): string | null {
  return getJsonString(value, key) || null;
}

function getJsonNumber(value: Record<string, unknown>, key: string): number | null {
  const candidate = value[key];
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate === "string" && candidate.trim() && Number.isFinite(Number(candidate))) return Number(candidate);
  return null;
}

function parseDockerPsLine(line: string): DockerContainer | null {
  const [id = "", name = "", image = "", status = "", ports = "", runningFor = "", labels = ""] = line.split("\t");
  const parsedLabels = parseDockerLabels(labels);

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    image,
    status,
    ports,
    runningFor,
    composeProject: parsedLabels["com.docker.compose.project"] ?? null,
    composeService: parsedLabels["com.docker.compose.service"] ?? null,
    composeWorkingDir: parsedLabels["com.docker.compose.project.working_dir"] ?? null
  };
}

function groupDockerContainers(containers: DockerContainer[]): DockerContainerGroup[] {
  const groupsById = new Map<string, DockerContainerGroup>();

  for (const container of containers) {
    const groupId = getDockerGroupId(container);
    const existingGroup = groupsById.get(groupId);

    if (existingGroup) {
      existingGroup.containers.push(container);
      continue;
    }

    groupsById.set(groupId, {
      id: groupId,
      name: container.composeProject ?? container.name,
      composeProject: container.composeProject,
      workingDir: container.composeWorkingDir,
      containers: [container]
    });
  }

  return [...groupsById.values()]
    .map((group) => ({
      ...group,
      containers: group.containers.sort(sortContainers)
    }))
    .sort(sortGroups);
}

function getDockerGroupId(container: DockerContainer): string {
  if (!container.composeProject) {
    return `container:${container.id}`;
  }

  return ["compose", container.composeProject, container.composeWorkingDir ?? ""].join(":");
}

function sortGroups(leftGroup: DockerContainerGroup, rightGroup: DockerContainerGroup): number {
  if (leftGroup.composeProject && !rightGroup.composeProject) {
    return -1;
  }

  if (!leftGroup.composeProject && rightGroup.composeProject) {
    return 1;
  }

  return leftGroup.name.localeCompare(rightGroup.name);
}

function sortContainers(leftContainer: DockerContainer, rightContainer: DockerContainer): number {
  const leftName = leftContainer.composeService ?? leftContainer.name;
  const rightName = rightContainer.composeService ?? rightContainer.name;

  return leftName.localeCompare(rightName);
}

function parseDockerLabels(labels: string): Record<string, string> {
  return labels
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((parsedLabels, label) => {
      const separatorIndex = label.indexOf("=");

      if (separatorIndex === -1) {
        parsedLabels[label] = "";
        return parsedLabels;
      }

      parsedLabels[label.slice(0, separatorIndex)] = label.slice(separatorIndex + 1);
      return parsedLabels;
    }, {});
}

function getDockerErrorMessage(output: string): string {
  const normalizedOutput = output.trim();

  if (/ENOENT|not found|is not recognized/i.test(normalizedOutput)) {
    return "Docker was not found in the Node process PATH.";
  }

  if (/cannot connect|daemon|docker engine|docker desktop/i.test(normalizedOutput)) {
    return "Docker is not running or the daemon is unreachable.";
  }

  return normalizedOutput.split("\n")[0] || "Unable to read the Docker containers.";
}
