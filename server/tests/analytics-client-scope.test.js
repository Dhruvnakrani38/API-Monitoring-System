import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsController } from '../src/services/analytics/controller/analyticsController.js';

test('dashboard analytics stays scoped to the authenticated client', async () => {
  const requestedClientIds = [];
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  const controller = new AnalyticsController({
    analyticsService: {
      getOverallStats: async (clientId) => {
        requestedClientIds.push(clientId);
        return {};
      },
      getTopEndpoints: async (clientId) => {
        requestedClientIds.push(clientId);
        return [];
      },
      getTimeSeries: async (clientId) => {
        requestedClientIds.push(clientId);
        return [];
      },
    },
    authService: {
      checkSuperAdminPermissions: async () => false,
      getProfile: async () => ({ permissions: { canViewAnalytics: true } }),
    },
    clientRepository: {
      findById: async (clientId) => ({ _id: clientId }),
    },
  });

  await controller.getDashboard({
    user: { userId: 'user-1', clientId: 'aaaaaaaaaaaaaaaaaaaaaaaa' },
    query: { clientId: 'bbbbbbbbbbbbbbbbbbbbbbbb' },
  }, response, (error) => {
    throw error;
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(requestedClientIds, [
    'aaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaa',
    'aaaaaaaaaaaaaaaaaaaaaaaa',
  ]);
});
