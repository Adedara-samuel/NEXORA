#!/usr/bin/env node
/**
 * A small, dependency-free load probe for local use — NOT part of CI, NOT
 * run against production, and NOT a substitute for a real load-testing
 * setup (k6/autocannon/Gatling against a realistically-sized dataset).
 * What it actually gives you: a quick, repeatable sanity check that a
 * change didn't silently make a hot endpoint (dashboard, employee list)
 * dramatically slower under light concurrency, using only Node's built-in
 * fetch — nothing to install.
 *
 * Usage (core-api running locally, a real organisation + admin already seeded):
 *   node scripts/load-test.mjs --token "<access token>" --concurrency 10 --requests 200
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);

const BASE = args.base ?? "http://localhost:4000/api/v1";
const TOKEN = args.token;
const CONCURRENCY = Number(args.concurrency ?? 10);
const TOTAL_REQUESTS = Number(args.requests ?? 200);
const PATH = args.path ?? "/organisation/dashboard/summary";

if (!TOKEN) {
  console.error('Missing --token. Log in as an organisation user and pass their accessToken:\n  node scripts/load-test.mjs --token "eyJ..."');
  process.exit(1);
}

async function timedRequest() {
  const start = performance.now();
  const res = await fetch(`${BASE}${PATH}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  await res.arrayBuffer(); // drain the body so the connection is actually done, not just headers
  return { ms: performance.now() - start, status: res.status };
}

async function worker(queue, results) {
  while (queue.remaining > 0) {
    queue.remaining -= 1;
    results.push(await timedRequest());
  }
}

function percentile(sorted, p) {
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function main() {
  console.log(`Hitting ${PATH} — ${TOTAL_REQUESTS} requests at concurrency ${CONCURRENCY}...`);
  const queue = { remaining: TOTAL_REQUESTS };
  const results = [];
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue, results)));
  const totalSeconds = (performance.now() - startedAt) / 1000;

  const byStatus = results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] ?? 0) + 1), acc), {});
  const timings = results.filter((r) => r.status === 200).map((r) => r.ms).sort((a, b) => a - b);

  console.log(`\nStatus codes: ${JSON.stringify(byStatus)}`);
  console.log(`Throughput:   ${(results.length / totalSeconds).toFixed(1)} req/s over ${totalSeconds.toFixed(1)}s`);
  if (timings.length > 0) {
    console.log(`Latency (ms): p50=${percentile(timings, 50).toFixed(0)}  p95=${percentile(timings, 95).toFixed(0)}  p99=${percentile(timings, 99).toFixed(0)}  max=${timings.at(-1).toFixed(0)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
