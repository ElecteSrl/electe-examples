// Live checks. Unauthenticated ones always run; authenticated ones need ELECTE_API_KEY.
//   node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { ElecteApi, ElecteApiError } from './electe-api.mjs';

const API_KEY = process.env.ELECTE_API_KEY ?? '';
const MCP_ENDPOINT = process.env.ELECTE_MCP_ENDPOINT ?? 'https://mcp.electe.net/sse';

test('a missing key is a 401 problem document', async () => {
  await assert.rejects(
    () => new ElecteApi({ apiKey: '' }).me(),
    (error) => error instanceof ElecteApiError && error.status === 401 && error.code === 'UNAUTHORIZED'
      && (error.headers['content-type'] ?? '').includes('application/problem+json')
  );
});

test('an invalid key is a 401 problem document', async () => {
  await assert.rejects(() => new ElecteApi({ apiKey: 'not-a-real-key' }).me(), (e) => e.status === 401 && e.code === 'UNAUTHORIZED');
});

test('an unknown route is a 404 problem document', async () => {
  await assert.rejects(() => new ElecteApi({ apiKey: '' }).get('/v1/this-route-does-not-exist'), (e) => e.status === 404 && e.code === 'NOT_FOUND');
});

test('the MCP endpoint rejects a missing key as a JSON-RPC error', async () => {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  });
  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.jsonrpc, '2.0');
  assert.equal(payload.error.code, -32600);
});

test('authenticated: /v1/me answers 200 with an object', { skip: !API_KEY && 'ELECTE_API_KEY not set' }, async () => {
  const api = new ElecteApi();
  const me = await api.me();
  assert.equal(typeof me, 'object');
  assert.ok('x-ratelimit-limit' in api.lastRateLimit);
});

test('authenticated: /v1/workspaces is a paginated list', { skip: !API_KEY && 'ELECTE_API_KEY not set' }, async () => {
  const page = await new ElecteApi().workspaces({ limit: 5 });
  assert.ok(Array.isArray(page.data));
  assert.equal(typeof page.page, 'object');
});
