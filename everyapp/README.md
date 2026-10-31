# EveryApp examples

Apps built on ELECTE's EveryApp Gateway at `https://apps.electe.net` (Cloudflare Workers + D1 behind Cloudflare
Access, the `ELECTE · Apps` gate).

- [`ideas/`](ideas/) — the worked example (2026-10-31): a shared board of social-post ideas by status, identity from
  the Gateway, three MCP tools (`ideas_list_ideas`, `ideas_add_idea`, `ideas_move_idea`), ELECTE colours. Live at
  `https://ideas.apps.electe.net`; its README section "How this example works" walks through it. Deployed with the
  `everyapp` CLI from a checkout of this folder; the folder's own `.github/workflows` do not run from here (GitHub
  reads only the repository root's).
