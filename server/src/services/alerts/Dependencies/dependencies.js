import postgres from '../../../shared/config/postgres.js';
import logger from '../../../shared/config/logger.js';
import clientRepository from '../../client/repository/ClientRepository.js';
import authContainer from '../../auth/Dependencies/dependencies.js';
import { AlertRepository } from '../repository/AlertRepository.js';
import { AlertService } from '../services/AlertService.js';
import { AlertController } from '../controller/AlertController.js';
import { AlertEvaluator } from '../services/AlertEvaluator.js';
import processorContainer from '../../processor/Dependencies/dependencies.js';

const alertRepository = new AlertRepository({ postgres, logger });
const alertService = new AlertService({ repository: alertRepository });
const alertEvaluator = new AlertEvaluator({
    alertRepository,
    metricsRepository: processorContainer.repositories.metricsRepository,
    logger,
});
const alertController = new AlertController({
    alertService,
    authService: authContainer.services.authService,
    clientRepository,
});

export default {
    repositories: { alertRepository },
    services: { alertService, alertEvaluator },
    controllers: { alertController },
};