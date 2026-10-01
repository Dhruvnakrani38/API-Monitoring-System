import postgres from '../../../shared/config/postgres.js';
import clientRepository from '../../client/repository/ClientRepository.js';
import authContainer from '../../auth/Dependencies/dependencies.js';
import { SyntheticRepository } from '../repository/SyntheticRepository.js';
import { SyntheticService } from '../services/SyntheticService.js';
import { SyntheticController } from '../controller/SyntheticController.js';

const repository = new SyntheticRepository({ postgres });
const service = new SyntheticService({ repository });
export default {
    repositories: { syntheticRepository: repository },
    services: { syntheticService: service },
    controllers: { syntheticController: new SyntheticController({ service, authService: authContainer.services.authService, clientRepository }) },
};