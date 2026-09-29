// GET /v1/me — the calling key: its user, its scopes, the workspaces it can reach.
import { run } from './electe-api.mjs';

run((api) => api.me());
