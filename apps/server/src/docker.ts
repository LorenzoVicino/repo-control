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

export function stopDockerContainers(
  cwd: string,
  containerIds: string[],
  runCommand: CommandRunner
): Promise<CommandResult> {
  return runCommand(cwd, "docker", ["stop", ...containerIds], 1000 * 60 * 5);
}

function parseDockerPsOutput(output: string): DockerContainer[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseDockerPsLine)
    .filter((container): container is DockerContainer => container !== null);
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
    return "Docker non trovato nel PATH del processo Node.";
  }

  if (/cannot connect|daemon|docker engine|docker desktop/i.test(normalizedOutput)) {
    return "Docker non e' avviato o il daemon non e' raggiungibile.";
  }

  return normalizedOutput.split("\n")[0] || "Impossibile leggere i container Docker.";
}
