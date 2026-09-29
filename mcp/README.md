# The ELECTE MCP server

ELECTE runs a Model Context Protocol server so Claude Desktop, Claude Code, Cursor or any
MCP client can query the business data your integrations have synced. Read-focused, one
direction: assistants query ELECTE; ELECTE never acts on external systems through MCP.

| | |
|---|---|
| Endpoint | `https://mcp.electe.net/sse` |
| Transport | JSON-RPC over HTTP `POST` (streamable HTTP). The `/sse` path is a name; there is no event stream to subscribe to. |
| Auth | `Authorization: Bearer <key>` (`x-api-key: <key>` is also accepted). Keys are personal and created on the platform's **MCP Server** screen, revocable there. |
| Tools | `list_integrations`, `get_integration`, `sync_integration`, `get_synced_data`, `search_synced_data`, `get_sync_logs`, `get_data_sources` — six lookups and one action (a sync you could trigger yourself). |
| Residency | Data hosted in Germany; the server sends nothing to model providers. |

Everything here mirrors [electe.net/mcp](https://www.electe.net/mcp); when the two differ, the site wins.

## Connect a client

The files beside this README are the three snippets the site publishes:

- [`claude_desktop_config.json`](claude_desktop_config.json) — Claude Desktop, through `mcp-remote`. The header goes through `env`, not inline: some clients mangle spaces inside `args`, and it keeps the key out of the process list.
- [`claude-code.sh`](claude-code.sh) — Claude Code, one command.
- [`any-client.txt`](any-client.txt) — what to type into a client with its own remote-server form (Cursor, agent frameworks).

Restart the client; ELECTE's tools appear automatically.

## Call it without a client

[`mcp_client.py`](mcp_client.py) is the protocol in 120 lines, standard library only:
`initialize`, `notifications/initialized`, then `tools/list`, or `tools/call` for one tool.

```bash
export ELECTE_MCP_KEY=...                        # from the platform's MCP Server screen
python mcp_client.py                             # lists the tools with their input schemas
python mcp_client.py list_integrations           # calls a tool with no arguments
python mcp_client.py search_synced_data '{"query": "revenue"}'
```

The tools' argument schemas come from the live `tools/list` answer, which is why this
repository does not restate them.

Send a `User-Agent` header: the endpoint answers HTTP 403 to Python's default one, and
`mcp_client.py` sets its own.

Without a key the server answers HTTP 401 with a JSON-RPC error — the exact body is in
[`../fixtures/mcp-401-missing-key.json`](../fixtures/mcp-401-missing-key.json), and the tests in
`python/` and `node/` check that shape on every run.
