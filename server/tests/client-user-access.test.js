import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientService } from '../src/services/client/services/clientService.js';

const buildService = (createUser) => new ClientService({
  clientRepository: {
    findById: async (clientId) => ({ _id: clientId }),
  },
  apiKeyRepository: {},
  userRepository: {
    create: createUser,
  },
});

const userData = {
  username: 'team-user',
  email: 'team@example.com',
  password: 'StrongPass1!',
};
const clientId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

test('client viewers cannot add users', async () => {
  let created = false;
  const service = buildService(async () => {
    created = true;
  });

  await assert.rejects(
    service.createClientUser(clientId, userData, {
      userId: 'viewer-1',
      role: 'client_viewer',
      clientId,
    }),
    (error) => error.statusCode === 403,
  );
  assert.equal(created, false);
});

test('client admins create active approved users in their own client', async () => {
  let createdUser;
  const service = buildService(async (data) => {
    createdUser = data;
    return { _id: 'new-user', ...data };
  });

  const user = await service.createClientUser(clientId, userData, {
    userId: 'client-admin-1',
    role: 'client_admin',
    clientId,
  });

  assert.equal(createdUser.clientId, clientId);
  assert.equal(createdUser.isActive, true);
  assert.equal(createdUser.isApproved, true);
  assert.equal(createdUser.approvalStatus, 'approved');
  assert.equal(user.role, 'client_viewer');
  assert.equal('password' in user, false);
});
