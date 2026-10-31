# Ideas

An example app on ELECTE's EveryApp Gateway: a shared board where Fabio and Anne collect social-post ideas. It is small on purpose, so you can read all of it and see how an EveryApp app works.

- **Live at** https://ideas.apps.electe.net (behind the Gateway at https://apps.electe.net).
- **An idea** has a title, a short note, a channel (LinkedIn, X, Newsletter, Blog), a status (idea, draft, scheduled, posted), an optional target date, who added it and when, and who last changed it and when.
- **The board** has four columns, one per status. Each card has a button to move it back or forward (keyboard and screen-reader friendly, no drag and drop), an Edit button, a filter by channel on top, and an empty state.
- **Claude can use it** through three tools (list, add, move) once the Gateway's MCP is connected.
- **Content is non-sensitive.** No customer data, no AI keys, no mail sender, no secrets.

## How this example works

### Where the data lives

In one D1 (SQLite) database that belongs to this app, in ELECTE's Cloudflare account. The first deploy creates it and applies the migrations in `drizzle/`. The schema is `src/db/schema.ts`: one table, `ideas`, one row per idea, and every row carries `org_id`, the organization it belongs to. There is no other storage: no KV, no R2, no external API.

Look at the live data from this folder: `everyapp db query "select title, status, added_by_email from ideas" --json` (add `--local` for the development copy; a write to the live database stops and asks for an explicit yes).

### How identity reaches the app

The app has **no login, no session, no cookie and no token check**. The Gateway signs people in. For every request it then sends the app a short-lived (120 seconds) signed identity, after throwing away any identity header the browser sent. `everyApp()` in `src/entry.worker.ts` verifies that signature before any of the app's code runs; a request without a valid one is a 401.

The app reads who is calling in exactly one way, and uses three facts from it:

| From the signed identity | Used for                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `user.orgId`             | which board this is: every query is filtered by it (`src/server/ideas.ts`)                                                   |
| `user.id`, `user.email`  | stamped on the row as "added by" and "changed by" on the server; they are never form fields, so nobody can type another name |
| `user.orgRole`           | shown in the page footer only (everyone may edit the board)                                                                  |

In a page, that is `context.user` behind `ensureUserMiddleware` (`src/serverFunctions/ideas.ts`). In an MCP tool it is the `user` the handler receives (`src/tools.ts`). Never a header, cookie or argument a client sent: the input schemas (`src/lib/ideas.ts`) are strict, so an extra `orgId` or `addedBy` in a request is refused, and `src/server/ideas.test.ts` checks that a second organization can neither see, change, move nor delete the first one's ideas.

Sharing is the app's decision, not the Gateway's. `access: "everyone"` in `everyapp.config.ts` lets every member of the organization open the app (the default is owners and admins only); the app then decides what each person sees, here the same board for all. Anne has to be a member of the Gateway to open it: https://apps.electe.net/admin/users.

### How the MCP tools are exposed

`src/tools.ts` describes three tools with `defineTools()`, each with an honest `risk`:

| Tool         | Risk  | What it does                                                          |
| ------------ | ----- | --------------------------------------------------------------------- |
| `list_ideas` | read  | the board, optionally only one status or channel                      |
| `add_idea`   | write | adds an idea, recorded as added by the person the connection acts for |
| `move_idea`  | write | moves an idea to another status                                       |

The app does **not** speak MCP and has no `/mcp` route. The Gateway reads the catalogue when the app is deployed and serves it at `https://apps.electe.net/mcp` as `ideas_list_ideas`, `ideas_add_idea` and `ideas_move_idea`. It does the sign-in (OAuth or a personal token), refuses write tools to a read-only connection, checks the arguments against the schema, then calls the app with an identity minted for that single call. The tools run the same queries as the page, so Claude and a person see and change the same board. There is deliberately no delete tool: a destructive tool stays hidden from AI clients until the Gateway has approvals, and deleting is a thing a person does on the board.

To connect Claude Code:

```sh
claude mcp add --transport http everyapp https://apps.electe.net/mcp
```

then `/mcp`, choose **everyapp**, **Authenticate**, and ask Claude to add an idea, or to call `everyapp_whoami` to see who it acts as. claude.ai and Claude Desktop take the same URL as a custom connector.

### How to change and redeploy

```sh
pnpm install
pnpm dev                 # http://ideas.localhost:8787, signed in as a test user, local database
pnpm test                # queries, tools, input rules (in-memory SQLite with the real migration)
pnpm types:check
pnpm build
pnpm run deploy          # = everyapp deploy: build, migrate, upload, register; run it again for every change
```

- **A new field or table:** edit `src/db/schema.ts`, run `pnpm run db:generate`, commit the migration it writes. Never edit a migration that has already been deployed; write a new one.
- **Where things are:** the rules for an idea in `src/lib/ideas.ts`, the queries in `src/server/ideas.ts`, what the page calls in `src/serverFunctions/ideas.ts`, the tools in `src/tools.ts`, the page in `src/routes/index.tsx` and `src/components/`.
- **What the app is allowed to do** is the manifest, `everyapp.config.ts`: this one asks for a database and for everyone to open it, and nothing else (no public routes, capabilities, providers or secrets). To give it more, list it there and deploy.
- **Never** `wrangler deploy`, and never a login page: the Gateway owns both.
- Before a change that touches identity, queries or tools, review it against `.agents/skills/everyapp/security-review.md`.

## The look

ELECTE's colours: navy `#1a1f36` for text and the main action, off-white `#fbfaf7` cards, a warm grey behind the columns, system fonts and nothing loaded from outside. Teal is only the keyboard focus ring; it is the brand's `#2bb5a0` deepened to `#1f9d89` so the ring is clearly visible against the cards (the brand teal reaches only 2.4:1, the ring needs 3:1). The app is light only.
