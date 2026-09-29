// GET /v1/workspaces — every workspace the key can reach, walking all pages.
import { run } from './electe-api.mjs';

run(async (api) => {
  const rows = [];
  for await (const workspace of api.iterate((page) => api.workspaces(page))) rows.push(workspace);
  return rows;
});
