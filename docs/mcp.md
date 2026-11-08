# MCP server

repo-control exposes its agent tools through the [Model Context Protocol](https://modelcontextprotocol.io), so an MCP client such as Claude Code, Claude Desktop or an IDE can work with the repositories in a workspace: find the ones that need attention, read diffs and logs, commit, pull and push, manage Docker Compose services and run saved workflows.

The same tool catalog (`apps/server/src/services/tools/`) backs the in-app agent. A tool is validated and guarded once, whichever client calls it.

## Connect a client

### Claude Code, over stdio (recommended)

The client starts repo-control itself; no dashboard needs to be running.

```bash
# read-only tools
claude mcp add repo-control -- npx repo-control mcp ~/projects

# read and write tools
claude mcp add repo-control -- npx repo-control mcp ~/projects --allow-writes
```

Claude Code still asks before each tool call unless you allow it, so `--allow-writes` makes write tools available but does not approve them on your behalf.

### Claude Desktop and other stdio clients

```json
{
  "mcpServers": {
    "repo-control": {
      "command": "npx",
      "args": ["repo-control", "mcp", "/home/you/projects"]
    }
  }
}
```

### Over HTTP

A running repo-control also serves MCP at `http://127.0.0.1:3747/mcp` (Streamable HTTP). The endpoint is off until you set a bearer token of at least 32 characters:

```bash
# .env
REPO_CONTROL_MCP_TOKEN=paste-the-output-of-openssl-rand-hex-32-here
# Optional: also expose write tools to HTTP clients
# REPO_CONTROL_MCP_WRITE=on
```

```bash
claude mcp add --transport http repo-control http://127.0.0.1:3747/mcp \
  --header "Authorization: Bearer $REPO_CONTROL_MCP_TOKEN"
```

The HTTP endpoint is stateless: each `POST` carries one JSON-RPC message and gets one JSON response. `GET` and `DELETE` answer `405`.

## Tools

Read tools are always available. Write tools are listed only when writes are enabled (`--allow-writes` over stdio, `REPO_CONTROL_MCP_WRITE=on` over HTTP); otherwise a client never sees them.

| Area | Read | Write |
| --- | --- | --- |
| Repositories and Git | `list_repositories`, `get_repository`, `git_log`, `git_diff`, `list_branches` | `git_fetch`, `git_pull`, `git_push`, `git_checkout`, `git_create_branch`, `git_commit` |
| Docker Compose | `list_containers`, `compose_status`, `compose_logs` | `compose_up`, `compose_stop`, `compose_restart_service` |
| Workflows | `list_workflows`, `preview_workflow`, `get_workflow_run` | `run_workflow`, `cancel_workflow_run` |
| Coding-agent sessions | `list_agent_sessions` | none |

Every tool carries MCP annotations: `readOnlyHint` for read tools, and `destructiveHint`, `idempotentHint` and `openWorldHint` for writes. For example, `git_fetch` is idempotent and talks to remotes, and `run_workflow` is marked destructive because a workflow can run any shell command saved in it.

Repositories are named the way a person names them: `atlas-api`, a workspace-relative path such as `libs/shared`, or the `id` from `list_repositories`. An ambiguous or unknown name returns an error that lists the candidates, so the model can correct itself.

## Guarantees

- **Workspace boundary.** Every repository is re-resolved by the project resolver, so a tool can only reach Git repositories discovered under the workspace folder.
- **The dashboard's guards apply.** Pulls are fast-forward only, pushes are never forced, and switching or creating a branch is refused while the working tree has uncommitted changes.
- **No arbitrary commands.** There is no shell tool, and no tool can create or edit a workflow, because a workflow can contain shell commands. The agent can only run workflows you saved yourself.
- **Strict input.** Unknown fields, out-of-range values and option-like branch, file or service names are rejected before anything runs.
- **Compact, relative output.** Results use workspace-relative paths and truncate long diffs, logs and command output.

## Limits

- A workflow started over stdio runs in that process. The dashboard shows it in the run history but cannot cancel it, and stopping the MCP client stops the run.
- Over HTTP the endpoint uses one shared token. Anyone holding it has the access you configured; rotate it by changing the value and restarting.
