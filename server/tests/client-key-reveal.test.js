import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ClientService } from '../src/services/client/services/clientService.js';

const clientId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const passwordHash = await bcrypt.hash('StrongPass1!', 4);

const buildService = () => new ClientService({
  clientRepository: {
    findById: async (id) => ({ _id: id, name: 'Example Client' }),
  },
  apiKeyRepository: {
    findByClientId: async () => [{ keyId: 'key-1', keyValue: 'apim_secret', name: 'Production' }],
  },
  userRepository: {
    findById: async () => ({ password: passwordHash }),
  },
});

const clientAdmin = {
  userId: 'user-1',
  role: 'client_admin',
  clientId,
};

test('client admins must re-authenticate before revealing API keys', async () => {
  const service = buildService();

  await assert.rejects(
    service.revealClientApiKeys(clientId, clientAdmin, 'WrongPass1!'),
    (error) => error.statusCode === 401,
  );

  const keys = await service.revealClientApiKeys(clientId, clientAdmin, 'StrongPass1!');
  assert.equal(keys[0].keyValue, 'apim_secret');
});

test('client viewers cannot reveal API keys even with a valid password', async () => {
  const service = buildService();

  await assert.rejects(
    service.revealClientApiKeys(clientId, { ...clientAdmin, role: 'client_viewer' }, 'StrongPass1!'),
    (error) => error.statusCode === 403,
  );
});
