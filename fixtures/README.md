# Fixtures

Responses captured from the live endpoints on 2026-09-29, unchanged. The tests compare
against the *shape* of these (status, `content-type`, `code`), not the wording, which
the platform may edit.

| file | request | status |
|---|---|---|
| `401-missing-key.json` | `GET https://api.electe.net/v1/me` with no `Authorization` header | 401, `application/problem+json` |
| `401-invalid-key.json` | `GET https://api.electe.net/v1/me` with `Authorization: Bearer not-a-real-key` | 401, `application/problem+json` |
| `404-not-found.json` | `GET https://api.electe.net/v1/nope` | 404, `application/problem+json` |
| `mcp-401-missing-key.json` | `POST https://mcp.electe.net/sse` with `{"jsonrpc":"2.0","id":1,"method":"tools/list"}` and no key | 401, JSON-RPC error `-32600` |

Successful (200) bodies are not recorded here: they contain account data. The
`page`/`data` envelope of a list is shown on [api.electe.net](https://api.electe.net); each
example script prints the live body so you can see yours.
