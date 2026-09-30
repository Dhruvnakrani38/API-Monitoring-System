import test from 'node:test';
import assert from 'node:assert/strict';
import { IngestService } from '../src/services/ingest/services/ingestServices.js';

test('ingest validation accepts a measured zero-millisecond response', () => {
  const service = new IngestService({ eventProducer: { publishApiHit: async () => true } });

  assert.doesNotThrow(() => service.validateHitData({
    serviceName: 'demo-api',
    endpoint: '/api/demo/endpoint-1',
    method: 'GET',
    statusCode: 200,
    latencyMs: 0,
    clientId: 'client-1',
  }));
});