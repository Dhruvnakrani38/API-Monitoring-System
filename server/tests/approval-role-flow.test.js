import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/shared/models/User.js';
import { AuthService } from '../src/services/auth/service/authService.js';

const buildService = (clientService) => {
  const userRepository = {
    findById: async () => ({
      _id: 'user-1',
      username: 'demo-user',
      email: 'demo@example.com',
      password: 'hashed',
      role: 'client_viewer',
      approvalStatus: 'pending',
      isApproved: false,
      isActive: false,
      clientId: null,
    }),
    updateSafe: async (id, data) => ({ _id: id, ...data }),
  };

  return new AuthService(userRepository, clientService);
};

test('approveUser keeps the selected admin/client role and creates that access profile', async () => {
  const createdCalls = [];
  const clientService = {
    createClientWithApiKeyForUser: async (user, admin, role) => {
      createdCalls.push({ user, admin, role });
      return {
        client: { _id: 'client-1', name: 'Demo Client' },
        apiKey: { keyId: 'k-1', keyValue: 'apim_123' },
      };
    },
  };

  const service = buildService(clientService);
  const adminUser = { userId: 'admin-1', username: 'super-admin' };
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  User.findByIdAndUpdate = async () => ({
    _id: 'user-1',
    username: 'demo-user',
    email: 'demo@example.com',
    role: 'client_admin',
    clientId: 'client-1',
    permissions: {
      canCreateApiKeys: true,
      canManageUsers: true,
      canViewAnalytics: true,
      canExportData: true,
    },
  });

  try {
    const result = await service.approveUser('user-1', adminUser, clientService, 'client_admin');

    assert.equal(result.user.role, 'client_admin');
    assert.equal(createdCalls[0].role, 'client_admin');
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});

test('approveUser assigns an existing client without provisioning another client or key', async () => {
  const client = { _id: 'client-existing', name: 'Existing Client' };
  const clientService = {
    findClientById: async () => client,
    buildPermissionsForRole: () => ({ canViewAnalytics: true }),
    createClientWithApiKeyForUser: async () => {
      throw new Error('Should not provision another client');
    },
  };
  const service = buildService(clientService);
  const originalFindByIdAndUpdate = User.findByIdAndUpdate;
  User.findByIdAndUpdate = async (id, update) => ({
    _id: id,
    username: 'demo-user',
    email: 'demo@example.com',
    ...update,
  });

  try {
    const result = await service.approveUser(
      'user-1',
      { userId: 'admin-1', username: 'super-admin' },
      clientService,
      'client_viewer',
      client._id,
    );

    assert.equal(result.client, client);
    assert.equal(result.user.clientId, client._id);
    assert.equal(result.user.role, 'client_viewer');
    assert.equal(result.apiKey, null);
  } finally {
    User.findByIdAndUpdate = originalFindByIdAndUpdate;
  }
});
