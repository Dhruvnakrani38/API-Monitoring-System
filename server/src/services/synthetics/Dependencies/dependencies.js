import postgres from '../../../shared/config/postgres.js';
import clientRepository from '../../client/repository/ClientRepository.js';
import authContainer from '../../auth/Dependencies/dependencies.js';
import { SyntheticRepository } from '../repository/SyntheticRepository.js';
import { SyntheticService } from '../services/SyntheticService.js';
import { SyntheticController } from '../controller/SyntheticController.js';
import { JourneyRepository } from '../repository/JourneyRepository.js';
import { JourneyService } from '../services/JourneyService.js';
import { JourneyController } from '../controller/JourneyController.js';

const repository = new SyntheticRepository({ postgres });
const service = new SyntheticService({ repository });

const journeyRepository = new JourneyRepository({ postgres });
const journeyService = new JourneyService({ repository: journeyRepository });
const journeyController = new JourneyController({
    journeyService,
    authService: authContainer.services.authService,
    clientRepository,
});

export default {
    repositories: { syntheticRepository: repository, journeyRepository },
    services: { syntheticService: service, journeyService },
    controllers: {
        syntheticController: new SyntheticController({ service, authService: authContainer.services.authService, clientRepository }),
        journeyController,
    },
};