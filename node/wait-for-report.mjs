// Poll GET /v1/reports/{id}/status until generation ends, then print the report.
//   node wait-for-report.mjs <reportId> [everySeconds] [timeoutSeconds]
// Stages, from the API description: queued, analysing, writing, exporting, completed, failed.
// The status object is logged on every poll; the loop stops when any top-level string
// value is "completed" or "failed".
import { run } from './electe-api.mjs';

const [reportId, every = '5', timeout = '600'] = process.argv.slice(2);
if (!reportId) {
  console.error('usage: node wait-for-report.mjs <reportId> [everySeconds] [timeoutSeconds]');
  process.exit(2);
}
const TERMINAL = new Set(['completed', 'failed']);

run(async (api) => {
  const deadline = Date.now() + Number(timeout) * 1000;
  for (;;) {
    const status = await api.reportStatus(reportId);
    console.error(JSON.stringify(status));
    const stage = Object.values(status).find((v) => typeof v === 'string' && TERMINAL.has(v));
    if (stage === 'completed') return api.report(reportId);
    if (stage === 'failed') {
      console.error('→ generation failed');
      process.exit(1);
    }
    if (Date.now() > deadline) {
      console.error('→ timed out');
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, Number(every) * 1000));
  }
});
