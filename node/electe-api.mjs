/**
 * Minimal client for the ELECTE Platform API v1. Node 18+ (global fetch), no dependencies.
 *
 *   export ELECTE_API_KEY=...        # created in the platform's API keys panel
 *   node whoami.mjs
 *
 * Every v1 route is a GET authenticated with `Authorization: Bearer <key>`. Errors are
 * RFC 9457 problem documents and surface as ElecteApiError with `status`, `code` and
 * `problem`. A 429 is retried once after `Retry-After`.
 */
const DEFAULT_BASE_URL = 'https://api.electe.net';
const USER_AGENT = 'electe-examples/node (+https://github.com/ElecteSrl/electe-examples)';

export class ElecteApiError extends Error {
  constructor(status, problem, headers) {
    const code = problem?.code ?? 'UNKNOWN';
    super(`${status} ${code}: ${problem?.detail ?? problem?.title ?? ''}`);
    this.name = 'ElecteApiError';
    this.status = status;
    this.code = code;
    this.problem = problem ?? {};
    this.headers = headers;
  }
}

export class ElecteApi {
  constructor({ apiKey = process.env.ELECTE_API_KEY ?? '', baseUrl = process.env.ELECTE_API_BASE ?? DEFAULT_BASE_URL, fetchImpl = fetch } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    /** X-RateLimit-* and Retry-After from the most recent response. */
    this.lastRateLimit = {};
  }

  async get(path, params = {}, { retryOn429 = true } = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    const response = await this.fetch(url, { headers });
    this.lastRateLimit = Object.fromEntries(
      [...response.headers.entries()].filter(([k]) => k.startsWith('x-ratelimit') || k === 'retry-after')
    );
    if (response.ok) return response.json();
    let problem;
    const text = await response.text();
    try {
      problem = text ? JSON.parse(text) : {};
    } catch {
      problem = { title: text.slice(0, 200), status: response.status, code: 'NON_JSON' };
    }
    if (response.status === 429 && retryOn429) {
      const wait = Math.min(Number(response.headers.get('retry-after') ?? 1), 60);
      await new Promise((resolve) => setTimeout(resolve, wait * 1000));
      return this.get(path, params, { retryOn429: false });
    }
    throw new ElecteApiError(response.status, problem, Object.fromEntries(response.headers.entries()));
  }

  // Routes — all GET, all need the `read` scope.
  me() { return this.get('/v1/me'); }
  workspaces({ limit = 25, offset = 0 } = {}) { return this.get('/v1/workspaces', { limit, offset }); }
  workspace(workspaceId) { return this.get(`/v1/workspaces/${workspaceId}`); }
  dataSources(workspaceId, { limit = 25, offset = 0 } = {}) { return this.get(`/v1/workspaces/${workspaceId}/data-sources`, { limit, offset }); }
  reports(workspaceId, { limit = 25, offset = 0 } = {}) { return this.get(`/v1/workspaces/${workspaceId}/reports`, { limit, offset }); }
  report(reportId) { return this.get(`/v1/reports/${reportId}`); }
  reportStatus(reportId) { return this.get(`/v1/reports/${reportId}/status`); }
  usage(workspaceId, { limit = 25, offset = 0 } = {}) { return this.get(`/v1/workspaces/${workspaceId}/usage`, { limit, offset }); }
  webhooks(workspaceId, { limit = 25, offset = 0 } = {}) { return this.get(`/v1/workspaces/${workspaceId}/webhooks`, { limit, offset }); }

  /** Walk a paginated list (`limit`/`offset`, max 100 per page) to the end. */
  async *iterate(fetchPage, pageSize = 100) {
    let offset = 0;
    for (;;) {
      const page = await fetchPage({ limit: pageSize, offset });
      const rows = Array.isArray(page?.data) ? page.data : [];
      yield* rows;
      if (rows.length < pageSize) return;
      offset += pageSize;
    }
  }
}

/** Run one call, print the JSON, exit non-zero on a problem document. */
export async function run(call) {
  if (!process.env.ELECTE_API_KEY) {
    console.error('Set ELECTE_API_KEY — create a key in the platform\'s API keys panel at https://platform.electe.net');
    process.exit(2);
  }
  const api = new ElecteApi();
  try {
    console.log(JSON.stringify(await call(api), null, 2));
    if (Object.keys(api.lastRateLimit).length) console.error('→ ' + JSON.stringify(api.lastRateLimit));
  } catch (error) {
    if (error instanceof ElecteApiError) {
      console.error(JSON.stringify(error.problem, null, 2));
      console.error(`→ HTTP ${error.status} ${error.code}`);
      process.exit(1);
    }
    throw error;
  }
}
