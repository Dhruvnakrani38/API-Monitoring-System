import test from 'node:test';
import assert from 'node:assert/strict';
import { MetricsRepository } from '../src/services/processor/repository/MetricsRepository.js';

test('getMetrics builds a valid SQL query for filtered analytics data', async () => {
  let capturedSql = '';
  let capturedParams = [];

  const repo = new MetricsRepository({
    logger: { error() {} },
    postgres: {
      query: async ({ text, values }) => {
        capturedSql = text;
        capturedParams = values;
        return {
          rows: [{ service_name: 'api', endpoint: '/users', method: 'GET' }],
        };
      },
    },
  });

  const rows = await repo.getMetrics({
    clientId: 'client-1',
    serviceName: 'api',
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-02T00:00:00.000Z',
    limit: 10,
    offset: 2,
  });

  assert.equal(rows.length, 1);
  assert.match(capturedSql, /WHERE client_id = \$1 AND service_name = \$2 AND time_bucket >= \$3 AND time_bucket <= \$4/);
  assert.deepEqual(capturedParams, [
    'client-1',
    'api',
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
    10,
    2,
  ]);
});

test('upsertEndpointMetrics divides the complete weighted average numerator', async () => {
  let capturedSql = '';
  const repo = new MetricsRepository({
    logger: { error() {} },
    postgres: {
      query: async ({ text }) => {
        capturedSql = text;
        return { rows: [] };
      },
    },
  });

  await repo.upsertEndpointMetrics({
    clientId: 'client-1',
    serviceName: 'demo-api',
    endpoint: '/endpoint',
    method: 'GET',
    totalHits: 1,
    errorHits: 0,
    avgLatency: 0,
    minLatency: 0,
    maxLatency: 0,
    timeBucket: new Date(),
  });

  assert.match(capturedSql, /avg_latency = \(\s*\(\(endpoint_metrics\.avg_latency \* endpoint_metrics\.total_hits\)\s*\+\s*\(EXCLUDED\.avg_latency \* EXCLUDED\.total_hits\)\)\s*\/ NULLIF\(endpoint_metrics\.total_hits \+ EXCLUDED\.total_hits, 0\)/);
});
