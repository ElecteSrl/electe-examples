# electe-examples

Runnable examples against the [ELECTE platform](https://platform.electe.net): its
[REST API](https://api.electe.net), its [MCP server](https://www.electe.net/mcp) and the
integrations people build on them. Every example makes a real call; nothing here is a mock.

**Status:** maintained by ELECTE. CI runs the unauthenticated checks against the live
endpoints on every push and every Monday, and the authenticated ones when the repository
holds an API key. The OpenAPI snapshot is compared with the live document on the same
schedule.

## What is inside

| path | what it is |
|---|---|
| [`curl/`](curl/) | every v1 route as a shell script — `./examples.sh me`, `./examples.sh all <workspaceId>` |
| [`python/`](python/) | a 100-line client (standard library only), four example scripts, live tests |
| [`node/`](node/) | the same client on `fetch` (Node 18+, no dependencies), four scripts, live tests |
| [`mcp/`](mcp/) | the three client configs the site publishes, and a minimal MCP client that lists and calls the tools |
| [`integrations/`](integrations/) | an importable n8n workflow, the settings for Zapier and Make HTTP modules, the Postman collection |
| [`openapi/`](openapi/) | a dated snapshot of the API description; the live one at `api.electe.net/?path=openapi` wins |
| [`fixtures/`](fixtures/) | the error responses the API and the MCP endpoint really return, captured on a stated date |

## Quickstart

1. Create an API key in the platform's **API keys** panel (for the MCP server: the
   **MCP Server** screen — keys are separate).
2. Pick a language:

```bash
export ELECTE_API_KEY=...

# shell
cd curl && ./examples.sh me

# python 3.9+
cd python && python whoami.py && python list_workspaces.py

# node 18+
cd node && node whoami.mjs && node list-workspaces.mjs
```

Each script prints the JSON answer and, on stderr, the rate-limit headers. A problem
document (a non-2xx answer) is printed to stderr and the script exits non-zero.

## The API in one paragraph

Nine routes, all `GET`, all under `/v1`, all authenticated with `Authorization: Bearer <key>`
and the `read` scope: `/v1/me`, `/v1/workspaces` and one workspace's `data-sources`,
`reports`, `usage` and `webhooks`, plus one report's body and its generation `status`.
Lists paginate with `limit` (1–100, default 25) and `offset`. Every answer carries
`X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`; a `429` adds
`Retry-After`. Errors are RFC 9457 problem documents (`application/problem+json`) with a
stable `code` — `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`… — and a missing
resource is indistinguishable from one the key cannot see, on purpose. Credentials and
webhook signing secrets are never returned.

## The MCP server in one paragraph

`https://mcp.electe.net/sse`, JSON-RPC over HTTP `POST`, `Authorization: Bearer <key>`. Seven
tools over the data your integrations have synced — six lookups and one action, triggering a
sync. Read-focused and one-directional by design. Setup for Claude Desktop, Claude Code and
any other client is in [`mcp/`](mcp/).

## Running the tests

```bash
cd python && python -m unittest test_live -v     # 4 unauthenticated checks, +3 with a key
cd node && node --test                            # the same, on fetch
```

## Contributing

An example is worth adding when it makes a real call and prints what came back. Open a
pull request; CI runs the live checks. Questions about the API itself: support@electe.net.

## License

[MIT](LICENSE) © ELECTE S.R.L.
