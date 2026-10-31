import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway gives this app nothing it
// does not declare here, and this app declares very little on purpose.
export default defineEveryApp({
  id: "ideas",
  name: "Ideas",
  description: "A shared board where the team collects social-post ideas.",
  // The default is "admins" (owners and admins only). A board for the whole
  // team has to be opened to every member of the organization.
  access: "everyone",
  resources: {
    // One D1 database, bound as env.DB. The deploy creates it and applies the
    // migrations in drizzle/.
    d1: ["DB"],
  },
  // No public routes: every route needs a member the Gateway signed in.
  // No capabilities, providers or secrets: the board needs no mail, no AI
  // model and no key of its own.
});
