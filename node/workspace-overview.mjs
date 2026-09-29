// One workspace and everything v1 says about it: data sources, reports, usage, webhooks.
//   node workspace-overview.mjs <workspaceId>
import { run } from './electe-api.mjs';

const workspaceId = process.argv[2];
if (!workspaceId) {
  console.error('usage: node workspace-overview.mjs <workspaceId>');
  process.exit(2);
}

run(async (api) => ({
  workspace: await api.workspace(workspaceId),
  data_sources: await api.dataSources(workspaceId),
  reports: await api.reports(workspaceId),
  usage: await api.usage(workspaceId),
  webhooks: await api.webhooks(workspaceId),
}));
