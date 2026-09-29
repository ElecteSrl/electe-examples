# Integrations

Anything that speaks HTTP and JSON can call the API: one `GET`, one header, JSON back. These
are the ready-made pieces.

## n8n

Import [`n8n/electe-workspaces.json`](n8n/electe-workspaces.json) (Workflows → Import from
file), open the **GET /v1/workspaces** node and pick a *Bearer Auth* credential holding your
API key. Run it: the last node emits one item per workspace. Copy the HTTP Request node for any
other route in the [OpenAPI document](../openapi/electe-platform-api.yaml); they all take the
same credential and the same `limit`/`offset` query parameters.

## Zapier, Make and other HTTP modules

Use the generic HTTP / "Webhooks by Zapier" module with:

| field | value |
|---|---|
| Method | `GET` |
| URL | `https://api.electe.net/v1/…` (routes in the OpenAPI document) |
| Headers | `Authorization: Bearer <key>`, `Accept: application/json` |
| Query | `limit` (1–100, default 25) and `offset` for the list routes |

Errors come back as `application/problem+json` with a stable `code`; a `429` carries
`Retry-After` in seconds.

## Postman

The official collection: [Run in Postman](https://app.getpostman.com/run-collection/27378960-ad338f97-5e64-4d86-ae48-47699686ddca).
Set a collection variable `apiKey` and the requests fill the header themselves.

## Outbound webhooks

The v1 API lists a workspace's outbound webhooks (`GET /v1/workspaces/{id}/webhooks`); it does
not register them, and the signing secret is never returned. Registration and payload formats
are documented on [api.electe.net](https://api.electe.net) as they ship (`webhooks:write`).
