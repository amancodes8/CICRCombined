#!/usr/bin/env node
const { performance } = require('perf_hooks');

const BASE_URL = String(process.env.PERF_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const CONCURRENCY = Number.parseInt(process.env.PERF_CONCURRENCY || '10', 10);
const REQUESTS = Number.parseInt(process.env.PERF_REQUESTS || '120', 10);

const percentile = (sorted, p) => {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const runEndpoint = async ({ name, path, method = 'GET', body = null, headers = {} }) => {
  const durations = [];
  let success = 0;
  let failure = 0;

  let launched = 0;
  let completed = 0;
  const executeOne = async () => {
    launched += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (response.ok || response.status === 401 || response.status === 403) {
        success += 1;
      } else {
        failure += 1;
      }
    } catch {
      failure += 1;
    } finally {
      const ended = performance.now();
      durations.push(ended - started);
      completed += 1;
    }
  };

  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (launched < REQUESTS) {
      // eslint-disable-next-line no-await-in-loop
      await executeOne();
    }
  });
  await Promise.all(runners);

  const sorted = durations.slice().sort((a, b) => a - b);
  return {
    name,
    completed,
    success,
    failure,
    avgMs: Number((durations.reduce((sum, n) => sum + n, 0) / Math.max(1, durations.length)).toFixed(2)),
    p50Ms: Number(percentile(sorted, 50).toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    p99Ms: Number(percentile(sorted, 99).toFixed(2)),
  };
};

const run = async () => {
  const healthResult = await runEndpoint({
    name: 'health',
    path: '/api/health',
  });
  const loginResult = await runEndpoint({
    name: 'auth-login-invalid',
    path: '/api/auth/login',
    method: 'POST',
    body: {
      email: 'invalid@example.com',
      password: 'wrong-password',
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        concurrency: CONCURRENCY,
        requestsPerEndpoint: REQUESTS,
        results: [healthResult, loginResult],
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('perf_smoke_failed:', error.message);
  process.exitCode = 1;
});
