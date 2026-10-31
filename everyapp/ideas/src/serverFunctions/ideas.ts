import { createServerFn } from "@tanstack/react-start";
import { gatewayUrl } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { env } from "cloudflare:workers";
import {
  createIdeaInput,
  deleteIdeaInput,
  moveIdeaInput,
  parseInput,
  updateIdeaInput,
} from "@/lib/ideas";
import * as ideas from "@/server/ideas";

// Each server function runs behind ensureUserMiddleware: `context.user` is the
// person the Gateway signed in, verified. Who is acting, and which organization's
// board it is, come from that and from nothing the browser sent.

const GONE =
  "That idea no longer exists: someone may have deleted it. The board has been refreshed.";

/** The first screen: the organization's board, and who is looking at it. */
export const getBoard = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => ({
    // Never the whole identity: pick what the page shows.
    me: { email: user.email, role: user.orgRole, org: user.orgName ?? null },
    ideas: await ideas.listIdeas(user.orgId),
    // The way back: the Gateway, or `everyapp dev`'s launcher.
    launcher: gatewayUrl(env),
  }));

export const addIdea = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parseInput(createIdeaInput, data))
  .handler(({ data, context }) => ideas.createIdea(context.user, data));

export const editIdea = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parseInput(updateIdeaInput, data))
  .handler(async ({ data, context }) => {
    const idea = await ideas.updateIdea(context.user, data);
    if (!idea) throw new Error(GONE);
    return idea;
  });

export const moveIdea = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parseInput(moveIdeaInput, data))
  .handler(async ({ data, context }) => {
    const idea = await ideas.moveIdea(context.user, data);
    if (!idea) throw new Error(GONE);
    return idea;
  });

export const removeIdea = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parseInput(deleteIdeaInput, data))
  .handler(async ({ data, context }) => {
    const idea = await ideas.deleteIdea(context.user.orgId, data);
    if (!idea) throw new Error(GONE);
    return idea;
  });
