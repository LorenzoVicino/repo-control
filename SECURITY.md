# Security

repo-control is designed for local use on a developer workstation.

It can execute Git, Docker and terminal commands inside repositories under the configured workspace folder. Do not expose the API or web server to the public internet.

## Supported use

- Bind to `127.0.0.1`.
- Use a workspace folder that only contains repositories you intend to manage.
- Review terminal commands before running them.
- Do not store credentials, tokens or private project data in committed configuration.

## Reporting issues

If you find a security issue, report it privately to the project maintainers before opening a public issue.
